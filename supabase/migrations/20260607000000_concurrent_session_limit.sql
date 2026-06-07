-- ============================================================================
-- Concurrent login limit — max 2 active device sessions for the owner.
-- ============================================================================
-- Single-owner app, but the owner may use a few devices/tablets. This caps
-- simultaneous logins at 2. A 3rd login is REJECTED (existing sessions are
-- never kicked out).
--
-- A slot frees up when:
--   • the device logs out (row deleted in the logout action), OR
--   • the session goes stale: 12h without any request. This backstop stops a
--     tablet closed without logout from holding a slot forever and locking the
--     owner out. (Not an inactivity timeout for active devices — last_seen
--     slides on every request.)
--
-- Storage: one row per active device, keyed by an app-session id that lives in
-- the httpOnly `souvenir_sid` cookie (independent of Supabase's own auth
-- cookies). Enforcement is split:
--   • register_session — login-time gate (reap stale → count → insert if < 2)
--   • touch_session    — per-request liveness check + sliding last_seen
-- Both are SECURITY DEFINER + auth.uid()-scoped, mirroring the PIN RPCs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_sessions_user_idx
  ON public.app_sessions (user_id, last_seen);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: the owner only ever sees/manages their own session rows. Combined with
-- the SECURITY DEFINER RPCs below this is defense-in-depth — direct table
-- access (e.g. the logout delete) stays scoped to auth.uid().
CREATE POLICY "app_sessions_select_own" ON public.app_sessions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "app_sessions_insert_own" ON public.app_sessions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "app_sessions_update_own" ON public.app_sessions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "app_sessions_delete_own" ON public.app_sessions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ── register_session(sid) → boolean ──
-- Called once per successful login. Returns true if a slot was granted (and
-- the row inserted), false if the 2-session limit is already reached.
-- Atomic: locks the owner's profile row as a mutex so two devices racing for
-- the last slot can't both pass the count check and create a 3rd session.
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
  IF v_count >= 2 THEN
    RETURN false;
  END IF;

  INSERT INTO app_sessions (id, user_id) VALUES (p_sid, v_uid);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_session(uuid) TO authenticated;

-- ── touch_session(sid) → boolean ──
-- Called from middleware on each authenticated request. Returns true if the
-- session is still valid (row exists), false if it was reaped/evicted (the
-- caller then signs the device out). Slides last_seen forward, throttled to
-- one write per 2 minutes to avoid a write on every single request.
CREATE OR REPLACE FUNCTION public.touch_session(p_sid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app_sessions WHERE id = p_sid AND user_id = v_uid) THEN
    RETURN false;
  END IF;

  UPDATE app_sessions
     SET last_seen = now()
   WHERE id = p_sid
     AND user_id = v_uid
     AND last_seen < now() - interval '2 minutes';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_session(uuid) TO authenticated;
