-- ============================================================================
-- Fix: admin PIN RPCs couldn't resolve crypt() / gen_salt()
-- ============================================================================
-- On Supabase, pgcrypto installs into the `extensions` schema (not `public`).
-- The original migration's `SET search_path = public, pg_temp` hid those
-- functions from the plpgsql body, so every set_admin_pin / verify_admin_pin
-- call failed with "function crypt(...) does not exist" and the client saw
-- "Nicht gespeichert" (internal error).
--
-- Fix: call crypt / gen_salt via the fully qualified extensions.* names.
-- Works regardless of where pgcrypto was installed, and doesn't widen
-- search_path (which is a SECURITY DEFINER hygiene concern).
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
  RETURN v_hash = extensions.crypt(p_pin, v_hash);
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

  -- Rotation: verify the current PIN before replacing.
  IF v_existing IS NOT NULL THEN
    IF p_current_pin IS NULL OR v_existing <> extensions.crypt(p_current_pin, v_existing) THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE profiles
  SET admin_pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10))
  WHERE id = v_uid;

  RETURN true;
END;
$$;
