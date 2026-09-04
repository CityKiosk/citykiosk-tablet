-- ============================================================================
-- extend_admin_pin_unlock: absolute Obergrenze fürs Gleit-Fenster (30 min)
-- ============================================================================
-- extend_admin_pin_unlock schob das Unlock-Fenster bei jedem Aufruf um 5 min
-- nach vorn, OHNE absolute Grenze. Am geteilten Tablet konnte der Kunde nach
-- einem einzigen Owner-Unlock die RPC direkt per PostgREST in einer Schleife
-- (<5 min Takt) aufrufen und das Scope UNBEGRENZT offen halten (threat-model
-- K4). Nach den Fixes #1/#2 verlängert das u.a. das Fenster für
-- update_display_field und die Share-Link-Erstellung.
--
-- Fix OHNE Eingriff in verify_admin_pin/set_admin_pin (Regressionsfläche der
-- kritischen PIN-RPCs klein halten): eine neue Spalte admin_pin_unlock_max
-- hält pro Scope eine absolute Deadline. Der ERSTE extend nach einem frischen
-- Unlock (max fehlt oder liegt in der Vergangenheit) setzt max = now()+30min;
-- danach kappt extend das Fenster auf min(now()+5min, max). Sobald max
-- erreicht ist, gleitet nichts mehr → das Scope läuft spätestens nach ~30 min
-- ab, egal wie oft extend gerufen wird. is_admin_pin_unlocked bleibt
-- unverändert (liest die until-Marke, die nie über max hinausgeht).
--
-- Die Spalte wird NUR von dieser SECURITY-DEFINER-RPC geschrieben; authenticated
-- hat weder UPDATE auf profiles noch SELECT auf diese Spalte (Migration
-- 20260811000000), also nicht manipulierbar.
--
-- Kleiner UX-Rand: ein erneuter PIN-Unlock INNERHALB eines laufenden Fensters
-- setzt die Deadline NICHT zurück (die Kappung misst ab dem ersten Unlock der
-- Kette). 30 min sind großzügig; im Normalbetrieb unmerklich.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_pin_unlock_max jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.extend_admin_pin_unlock(p_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
  v_max text;
  v_max_ts timestamptz;
  v_new_until timestamptz;
  c_max_life constant interval := interval '30 minutes';
  c_slide constant interval := interval '5 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
    RETURN;
  END IF;

  SELECT admin_pin_unlocks->>p_scope, admin_pin_unlock_max->>p_scope
    INTO v_current, v_max
    FROM profiles WHERE id = v_uid;

  -- Nur ein aktuell offenes Fenster wird verlängert (wie bisher).
  IF v_current IS NULL OR v_current::timestamptz <= now() THEN
    RETURN;
  END IF;

  -- Frischer Unlock (keine/abgelaufene Deadline) → absolute Grenze neu setzen.
  v_max_ts := CASE WHEN v_max IS NULL THEN NULL ELSE v_max::timestamptz END;
  IF v_max_ts IS NULL OR v_max_ts <= now() THEN
    v_max_ts := now() + c_max_life;
  END IF;

  -- Gleiten, aber nie über die absolute Deadline hinaus.
  v_new_until := LEAST(now() + c_slide, v_max_ts);

  UPDATE profiles
  SET admin_pin_unlocks   = COALESCE(admin_pin_unlocks, '{}'::jsonb)
                            || jsonb_build_object(p_scope, v_new_until::text),
      admin_pin_unlock_max = COALESCE(admin_pin_unlock_max, '{}'::jsonb)
                            || jsonb_build_object(p_scope, v_max_ts::text)
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_admin_pin_unlock(text) TO authenticated;
