-- ============================================================================
-- Per-scope admin PIN hash (Lager-PIN feature)
-- ============================================================================
-- Until now a single `admin_pin_hash` guarded every admin scope. The owner
-- can now optionally set a separate Lager-PIN for /stock so a clerk can
-- update inventory without seeing /settings.
--
-- Storage: jsonb `admin_pin_hashes` keyed by scope. The "default" key holds
-- the master / admin PIN that opens every scope. Per-scope keys (currently
-- only "stock") are optional overrides.
--
-- Verify semantics:
--   - If the requested scope has its own hash, accept that hash OR the
--     default hash (admin override — "master PIN opens everything").
--   - If the scope has no override, only the default hash is accepted.
--
-- Migration is reversible — the legacy `admin_pin_hash` column is left in
-- place during this rollout. A future migration drops it once we're sure
-- the new code path is stable.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_pin_hashes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: every existing admin_pin_hash becomes hashes.default. Idempotent
-- — running again on a row that already has hashes.default is a no-op.
UPDATE public.profiles
SET admin_pin_hashes = jsonb_build_object('default', admin_pin_hash)
WHERE admin_pin_hash IS NOT NULL
  AND NOT (admin_pin_hashes ? 'default');

-- ── verify_admin_pin(pin, scope) ──
-- Stamps the unlock for the given scope on success. Per-scope hash takes
-- priority; default hash is also accepted (admin master override).
CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin text, p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hashes jsonb;
  v_scope_hash text;
  v_default_hash text;
  v_match boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  SELECT admin_pin_hashes INTO v_hashes FROM profiles WHERE id = v_uid;
  IF v_hashes IS NULL OR v_hashes = '{}'::jsonb THEN
    RETURN false;
  END IF;

  v_scope_hash := v_hashes->>p_scope;
  v_default_hash := v_hashes->>'default';

  -- Prefer scope-specific hash if set, otherwise fall back to default.
  -- When the scope has its own hash, the default also still works (admin
  -- master override) so a forgotten Lager-PIN never bricks /stock.
  IF v_scope_hash IS NOT NULL AND v_scope_hash = extensions.crypt(p_pin, v_scope_hash) THEN
    v_match := true;
  ELSIF v_default_hash IS NOT NULL AND v_default_hash = extensions.crypt(p_pin, v_default_hash) THEN
    v_match := true;
  END IF;

  IF NOT v_match THEN
    RETURN false;
  END IF;

  UPDATE profiles
  SET admin_pin_unlocks = COALESCE(admin_pin_unlocks, '{}'::jsonb)
                       || jsonb_build_object(p_scope, (now() + interval '5 minutes')::text)
  WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_pin(text, text) TO authenticated;

-- ── set_admin_pin(current, new, scope) ──
-- Sets or rotates the PIN for a given scope. Scope defaults to 'default'
-- (the admin/master PIN). When setting a non-default scope, the current
-- PIN can be EITHER the existing scope PIN OR the default — so a clerk
-- never needs the admin PIN to be changed and the owner can rotate the
-- Lager-PIN with their admin PIN.
CREATE OR REPLACE FUNCTION public.set_admin_pin(
  p_current_pin text,
  p_new_pin text,
  p_scope text DEFAULT 'default'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hashes jsonb;
  v_scope_hash text;
  v_default_hash text;
  v_authorized boolean := false;
  v_new_hash text;
  v_settings_unlock_until text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'invalid pin format';
  END IF;
  IF p_scope NOT IN ('default', 'stock') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;

  SELECT admin_pin_hashes INTO v_hashes FROM profiles WHERE id = v_uid;
  v_hashes := COALESCE(v_hashes, '{}'::jsonb);
  v_scope_hash := v_hashes->>p_scope;
  v_default_hash := v_hashes->>'default';

  -- Defense in depth: a non-default scope can only be set AFTER the admin
  -- PIN exists. Without this, a freshly authenticated user could call this
  -- RPC directly with p_scope='stock' and no current PIN — the brand-new
  -- branch below would authorize them, and /stock would end up locked
  -- behind a PIN that bypasses the entire admin-PIN-first onboarding.
  IF p_scope <> 'default' AND v_default_hash IS NULL THEN
    RAISE EXCEPTION 'admin pin must be set before scope pins';
  END IF;

  -- Authorize the rotation. First-time setup of a brand-new user (no hashes
  -- at all) skips the current-PIN check. Any other case requires either the
  -- existing scope PIN or the default (admin) PIN.
  IF v_scope_hash IS NULL AND v_default_hash IS NULL THEN
    v_authorized := true;
  ELSIF p_current_pin IS NOT NULL THEN
    IF v_scope_hash IS NOT NULL AND v_scope_hash = extensions.crypt(p_current_pin, v_scope_hash) THEN
      v_authorized := true;
    ELSIF v_default_hash IS NOT NULL AND v_default_hash = extensions.crypt(p_current_pin, v_default_hash) THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN false;
  END IF;

  v_new_hash := extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12));

  -- Unlock /settings only when rotating the default PIN — the rotate UI
  -- lives there. Rotating the Lager-PIN does not auto-unlock anything.
  v_settings_unlock_until := CASE
    WHEN p_scope = 'default' THEN (now() + interval '5 minutes')::text
    ELSE NULL
  END;

  UPDATE profiles
  SET
    admin_pin_hashes = v_hashes || jsonb_build_object(p_scope, v_new_hash),
    -- Mirror the legacy column for the duration of the dual-write window.
    -- Kept consistent with default so any code path still reading the old
    -- column keeps working until it's dropped.
    admin_pin_hash = CASE WHEN p_scope = 'default' THEN v_new_hash ELSE admin_pin_hash END,
    admin_pin_unlocks = CASE
      WHEN v_settings_unlock_until IS NOT NULL THEN
        COALESCE(admin_pin_unlocks, '{}'::jsonb)
          || jsonb_build_object('settings', v_settings_unlock_until)
      ELSE admin_pin_unlocks
    END
  WHERE id = v_uid;

  RETURN true;
END;
$$;

-- Drop the old 2-arg signature so callers must pass the scope explicitly.
DROP FUNCTION IF EXISTS public.set_admin_pin(text, text);
GRANT EXECUTE ON FUNCTION public.set_admin_pin(text, text, text) TO authenticated;

-- ── remove_admin_pin(scope) ──
-- Removes a non-default scope PIN (currently only 'stock' is allowed).
-- The default PIN can never be removed via this RPC — once an admin PIN
-- is set the only way to "remove" it is to rotate to a different value.
-- Caller must supply the current default (admin) PIN to authorize.
CREATE OR REPLACE FUNCTION public.remove_admin_pin(
  p_admin_pin text,
  p_scope text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hashes jsonb;
  v_default_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('stock') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;

  SELECT admin_pin_hashes INTO v_hashes FROM profiles WHERE id = v_uid;
  v_hashes := COALESCE(v_hashes, '{}'::jsonb);
  v_default_hash := v_hashes->>'default';

  IF v_default_hash IS NULL THEN
    RETURN false;
  END IF;
  IF p_admin_pin IS NULL OR v_default_hash <> extensions.crypt(p_admin_pin, v_default_hash) THEN
    RETURN false;
  END IF;

  UPDATE profiles
  SET admin_pin_hashes = v_hashes - p_scope
  WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_admin_pin(text, text) TO authenticated;

-- ── has_admin_pin(scope) ──
-- Backwards-compatible: keep the no-arg overload for the existing PinGate
-- "PIN already set?" check (treated as "default scope set?"). Add a scoped
-- overload so the settings UI can ask whether the Lager-PIN exists.
CREATE OR REPLACE FUNCTION public.has_admin_pin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hashes jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT admin_pin_hashes INTO v_hashes FROM profiles WHERE id = v_uid;
  RETURN v_hashes IS NOT NULL AND (v_hashes ? 'default');
END;
$$;

CREATE OR REPLACE FUNCTION public.has_admin_pin_for_scope(p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hashes jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('default', 'stock') THEN
    RETURN false;
  END IF;
  SELECT admin_pin_hashes INTO v_hashes FROM profiles WHERE id = v_uid;
  RETURN v_hashes IS NOT NULL AND (v_hashes ? p_scope);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_admin_pin_for_scope(text) TO authenticated;
