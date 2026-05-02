-- ============================================================================
-- Lager-PIN: drop the admin master override on unlock
-- ============================================================================
-- Previous behaviour (master override): both the scope-specific hash AND the
-- default (admin) hash unlocked /stock when a Lager-PIN was set. The owner's
-- mental model is the opposite — the Lager-PIN is the SECRET one, meant to
-- be issued to a clerk while the admin PIN stays with the owner. Allowing
-- admin PIN to also unlock /stock defeats the purpose: anyone holding the
-- admin PIN gets clerk access for free.
--
-- New rule: when a scope-specific hash is set, ONLY that hash unlocks the
-- scope. The default hash is still the fallback when the scope has no
-- override of its own.
--
-- Recovery path is unchanged: if the owner forgets the Lager-PIN they can
-- still enter /settings (admin PIN), tap "Lager-PIN entfernen", confirm
-- with the admin PIN, and /stock falls back to the admin PIN again.
--
-- set_admin_pin and remove_admin_pin keep accepting admin PIN as authorize
-- credential — the override only goes away on UNLOCK, not on rotate / remove.
-- ============================================================================

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

  -- Strict scope check: when the scope has its own hash, that's the ONLY
  -- credential that unlocks it. The admin (default) hash is the fallback
  -- only when there's no scope-specific override yet.
  IF v_scope_hash IS NOT NULL THEN
    IF v_scope_hash = extensions.crypt(p_pin, v_scope_hash) THEN
      v_match := true;
    END IF;
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
