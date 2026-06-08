-- ============================================================================
-- Raise concurrent-login limit from 2 to 6 devices.
-- ============================================================================
-- Only the slot count changes; the rest of register_session (FOR UPDATE mutex,
-- 12h stale reaper, same-sid re-login no-op) is identical to
-- 20260607000000_concurrent_session_limit.sql. touch_session is unaffected.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_session(p_sid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Serialize concurrent logins for this user.
  PERFORM 1 FROM profiles WHERE id = v_uid FOR UPDATE;

  -- Free up slots held by devices that vanished without logging out.
  DELETE FROM app_sessions
   WHERE user_id = v_uid
     AND last_seen < now() - interval '12 hours';

  -- Re-login / token refresh reusing the same sid keeps its slot.
  IF EXISTS (SELECT 1 FROM app_sessions WHERE id = p_sid AND user_id = v_uid) THEN
    UPDATE app_sessions SET last_seen = now() WHERE id = p_sid;
    RETURN true;
  END IF;

  SELECT count(*) INTO v_count FROM app_sessions WHERE user_id = v_uid;
  IF v_count >= 6 THEN
    RETURN false;
  END IF;

  INSERT INTO app_sessions (id, user_id) VALUES (p_sid, v_uid);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_session(uuid) TO authenticated;
