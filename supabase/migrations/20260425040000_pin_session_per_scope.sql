-- ============================================================================
-- Per-scope PIN unlock (replaces global admin_pin_unlocked_until)
-- ============================================================================
-- Threat model: tablet shared with customers. If the owner unlocks /settings
-- and walks away, the customer should NOT also have implicit access to
-- /stock, /orders, /customers — even though all four sit behind the same PIN.
-- A global unlock window violates that. Each gated screen now has its own
-- unlock timestamp; entering PIN on /settings unlocks /settings only.
--
-- Storage shape: jsonb on profiles. Adding a new scope is a code-only change
-- (new key in jsonb), no schema migration. Each scope value is an ISO ts;
-- expiry = ts > now().
--
-- Allowed scopes: 'settings', 'stock', 'orders', 'customers'. Validated at
-- the RPC layer (raise on unknown scope) so a typo can't silently no-op.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_pin_unlocks jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Drop the old single-window column. Anyone who unlocked under the old model
-- will simply re-enter PIN once after deploy. Clean break is safer than
-- carrying a stale global flag.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS admin_pin_unlocked_until;

-- Drop old single-arg signatures so the new ones replace cleanly.
DROP FUNCTION IF EXISTS public.verify_admin_pin(text);
DROP FUNCTION IF EXISTS public.extend_admin_pin_unlock();
DROP FUNCTION IF EXISTS public.is_admin_pin_unlocked();
DROP FUNCTION IF EXISTS public.lock_admin_pin();
DROP FUNCTION IF EXISTS public.set_admin_pin(text, text);

-- ── verify_admin_pin(pin, scope) ──
-- On success, stamps unlock for the given scope only. Window: 5 minutes,
-- sliding via extend_admin_pin_unlock as the owner uses the screen.
CREATE FUNCTION public.verify_admin_pin(p_pin text, p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
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
  SELECT admin_pin_hash INTO v_hash FROM profiles WHERE id = v_uid;
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;
  IF v_hash <> extensions.crypt(p_pin, v_hash) THEN
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
-- Setting/rotating a PIN unlocks the SETTINGS scope (the only place where
-- the rotate UI lives). Other scopes still require an explicit verify.
CREATE FUNCTION public.set_admin_pin(p_current_pin text, p_new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'invalid pin format';
  END IF;

  SELECT admin_pin_hash INTO v_existing FROM profiles WHERE id = v_uid;

  IF v_existing IS NOT NULL THEN
    IF p_current_pin IS NULL OR v_existing <> extensions.crypt(p_current_pin, v_existing) THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE profiles
  SET
    admin_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
    admin_pin_unlocks = COALESCE(admin_pin_unlocks, '{}'::jsonb)
                     || jsonb_build_object('settings', (now() + interval '5 minutes')::text)
  WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(text, text) TO authenticated;

-- ── is_admin_pin_unlocked(scope) ──
CREATE FUNCTION public.is_admin_pin_unlocked(p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_until text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
    RETURN false;
  END IF;
  SELECT admin_pin_unlocks->>p_scope INTO v_until FROM profiles WHERE id = v_uid;
  IF v_until IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_until::timestamptz > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_pin_unlocked(text) TO authenticated;

-- ── extend_admin_pin_unlock(scope) ──
-- Sliding-window extender. Only extends if scope is currently unlocked —
-- prevents an attacker with auth-only access (no PIN) from "creating" an
-- unlock by spamming this RPC.
CREATE FUNCTION public.extend_admin_pin_unlock(p_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
    RETURN;
  END IF;

  SELECT admin_pin_unlocks->>p_scope INTO v_current FROM profiles WHERE id = v_uid;
  IF v_current IS NULL OR v_current::timestamptz <= now() THEN
    RETURN;
  END IF;

  UPDATE profiles
  SET admin_pin_unlocks = COALESCE(admin_pin_unlocks, '{}'::jsonb)
                       || jsonb_build_object(p_scope, (now() + interval '5 minutes')::text)
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_admin_pin_unlock(text) TO authenticated;

-- ── lock_admin_pin(scope) ──
-- Removes a single scope's unlock. NULL scope = clear ALL scopes (used on
-- logout and full-reset paths).
CREATE FUNCTION public.lock_admin_pin(p_scope text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope IS NULL THEN
    UPDATE profiles SET admin_pin_unlocks = '{}'::jsonb WHERE id = v_uid;
  ELSE
    IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
      RETURN;
    END IF;
    UPDATE profiles
    SET admin_pin_unlocks = COALESCE(admin_pin_unlocks, '{}'::jsonb) - p_scope
    WHERE id = v_uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_admin_pin(text) TO authenticated;
