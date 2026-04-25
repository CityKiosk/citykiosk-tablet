-- ============================================================================
-- Server-side PIN unlock state (M1)
-- ============================================================================
-- Threat: PinGate is purely client-side — `sessionStorage[scope_unlocked] = "1"`
-- bypasses every gate. Once a user is signed in, anyone with DevTools access
-- to the tablet can fire admin server actions directly. Server actions only
-- check auth, not PIN status.
--
-- Fix: persist a per-user "PIN was correctly entered" timestamp in profiles.
-- Server actions consult `admin_pin_unlocked_until > now()` before mutating.
-- TTL slides on each successful gated action — owner using the tablet stays
-- unlocked, idle tablet locks itself within the window.
-- ============================================================================

-- 1. Storage column. NULL = never unlocked / explicitly locked.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_pin_unlocked_until timestamptz;

-- 2. verify_admin_pin → on success, also stamp unlock window.
-- Window length: 4 hours. Long enough for a workday session, short enough
-- that a forgotten unlocked tablet self-locks before close.
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

  -- Mark unlocked.
  UPDATE profiles
  SET admin_pin_unlocked_until = now() + interval '4 hours'
  WHERE id = v_uid;

  RETURN true;
END;
$$;

-- 3. set_admin_pin → setting/rotating a PIN also unlocks for this window.
-- Rationale: the act of typing the new PIN twice (setup) or providing the old
-- PIN (rotation) proves possession; immediately requiring re-entry afterwards
-- is just friction with no security gain.
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
    admin_pin_unlocked_until = now() + interval '4 hours'
  WHERE id = v_uid;

  RETURN true;
END;
$$;

-- 4. Sliding-window extend. Called by every gated server action AFTER a
-- successful `is_admin_pin_unlocked()` check. Keeps the window fresh while
-- the owner is actively using the tablet, lets it expire on idle.
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
  -- Only extend if currently unlocked — prevents an attacker with auth-only
  -- access (no PIN) from "creating" an unlock by spamming this RPC.
  UPDATE profiles
  SET admin_pin_unlocked_until = now() + interval '4 hours'
  WHERE id = v_uid
    AND admin_pin_unlocked_until IS NOT NULL
    AND admin_pin_unlocked_until > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_admin_pin_unlock() TO authenticated;

-- 5. Lightweight status check used by PinGate to decide whether to render
-- the pinpad at all. Returns boolean only; never reveals expiry timestamp.
CREATE OR REPLACE FUNCTION is_admin_pin_unlocked()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  SELECT admin_pin_unlocked_until INTO v_until FROM profiles WHERE id = v_uid;
  RETURN v_until IS NOT NULL AND v_until > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_pin_unlocked() TO authenticated;

-- 6. Explicit lock. Lets the UI offer a "lock now" button without waiting
-- for TTL.
CREATE OR REPLACE FUNCTION lock_admin_pin()
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
  UPDATE profiles
  SET admin_pin_unlocked_until = NULL
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_admin_pin() TO authenticated;
