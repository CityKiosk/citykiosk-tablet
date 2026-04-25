-- ============================================================================
-- Admin PIN (replaces password re-auth for /settings + /stock gates)
-- ============================================================================
-- Re-entering the Supabase account password on a tablet virtual keyboard is
-- painful. A 6-digit PIN guards the same gates with a tablet-friendly numeric
-- pad. Threat model: brief physical access by a customer — not a remote
-- attacker. Rate-limited at the server-action layer (5 attempts / minute /
-- IP). Hash is bcrypt (pgcrypto), never leaves the DB.
-- ============================================================================

-- Ensure pgcrypto is available for crypt() + gen_salt().
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Column. Nullable — owners who haven't set a PIN yet are prompted to
-- set one on first access to a protected page.
ALTER TABLE public.profiles
  ADD COLUMN admin_pin_hash text;

-- 2. has_admin_pin: cheap boolean check used by the gate to decide between
-- "setup PIN" and "unlock" UI. No PIN material involved.
CREATE OR REPLACE FUNCTION has_admin_pin()
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
  SELECT admin_pin_hash INTO v_hash FROM profiles WHERE id = v_uid;
  RETURN v_hash IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_admin_pin() TO authenticated;

-- 3. verify_admin_pin: constant-time-ish compare via crypt(). Returns boolean
-- so the caller can't distinguish "no PIN set" from "wrong PIN" in telemetry.
-- Rate limit is enforced at the server-action layer.
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
  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_pin(text) TO authenticated;

-- 4. set_admin_pin: sets PIN for first time (p_current_pin ignored) or
-- rotates existing PIN (p_current_pin must match). Returns boolean:
--   true  → stored
--   false → wrong current PIN
-- Invalid format on new PIN raises, since that's a client-side bug not a
-- credential check failure.
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

  -- Rotation: verify the current PIN before replacing.
  IF v_existing IS NOT NULL THEN
    IF p_current_pin IS NULL OR v_existing <> crypt(p_current_pin, v_existing) THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE profiles
  SET admin_pin_hash = crypt(p_new_pin, gen_salt('bf', 10))
  WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(text, text) TO authenticated;
