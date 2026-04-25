-- ============================================================================
-- Tighten PIN unlock TTL to 5 minutes (was 4 hours)
-- ============================================================================
-- Original 4-hour window was an over-correction for UX. The PinGate now
-- always re-prompts on each admin page visit, so the server window's only
-- job is defense-in-depth against DevTools server-action calls. 5 minutes
-- aligns with IdleLock and limits the post-handover attack window if a
-- customer briefly takes the tablet during an active admin session.
--
-- The interval lives in three RPCs (verify, set, extend). All three updated
-- in lockstep here.
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_admin_pin(p_pin text)
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
  SET admin_pin_unlocked_until = now() + interval '5 minutes'
  WHERE id = v_uid;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION set_admin_pin(p_current_pin text, p_new_pin text)
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
    admin_pin_unlocked_until = now() + interval '5 minutes'
  WHERE id = v_uid;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION extend_admin_pin_unlock()
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
  -- Only slide the window if currently unlocked. Prevents an attacker with
  -- auth-only access (no PIN) from "creating" an unlock by spamming this RPC.
  UPDATE profiles
  SET admin_pin_unlocked_until = now() + interval '5 minutes'
  WHERE id = v_uid
    AND admin_pin_unlocked_until IS NOT NULL
    AND admin_pin_unlocked_until > now();
END;
$$;
