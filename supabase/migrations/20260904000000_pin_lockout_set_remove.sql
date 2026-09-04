-- ============================================================================
-- PIN-Brute-Force-Sperre: alle PIN-prüfenden RPCs, serialisiert, admin-only-Reset
-- ============================================================================
-- 20260814 hat den Zähler (profiles.pin_fail_count / pin_locked_until) nur in
-- verify_admin_pin eingebaut. set_admin_pin(p_current_pin, …) und
-- remove_admin_pin(p_admin_pin, …) vergleichen den PIN ebenfalls per bcrypt,
-- hatten aber weder Sperrprüfung noch Zähler → der Admin-PIN war über diese
-- beiden RPCs direkt per PostgREST brute-forcebar, auch während
-- verify_admin_pin bereits gesperrt war (threat-model K4 + K5).
--
-- Diese Migration definiert alle DREI Funktionen neu, mit identischer Regel:
--   • Sperre prüfen VOR dem bcrypt-Vergleich; gesperrt → false.
--   • Profilzeile mit FOR UPDATE lesen: parallele Aufrufe für dasselbe Profil
--     serialisieren, jeder Wartende sieht den aktuellen Zähler. Ohne das
--     konnten N gleichzeitige Rateversuche alle den Stand "9" lesen und den
--     Vergleich ausführen, bevor einer sperrt (TOCTOU).
--   • Fehlversuch: pin_fail_count+1; ab 10 → 15 Minuten Sperre.
--   • Zähler wird NUR zurückgesetzt, wenn der ADMIN-(default-)Hash gepasst
--     hat. Ein Treffer mit dem niedriger privilegierten Lager-PIN (scope
--     'stock') setzt nicht zurück — sonst könnte, wer den Lager-PIN kennt,
--     mit "9 Rateversuche + 1 Lager-PIN" den Admin-PIN unbegrenzt raten.
--   • Kein PIN (NULL) oder falsches Format (nicht 6 Ziffern) ist kein
--     Rateversuch: false ohne bcrypt, ohne Zählen — in allen drei Funktionen.
-- Bekannter Trade-off (unverändert seit 20260814): die Sperre gilt pro Profil
-- für alle Scopes; 10 falsche Eingaben sperren den Eigentümer 15 min aus
-- jeder PIN-Operation aus (Lockout-DoS, kein Vertraulichkeits-/Integritäts-
-- verlust). Signaturen, Rückgabewerte und Grants bleiben unverändert.
-- ============================================================================

-- ── verify_admin_pin: FOR UPDATE + Reset nur bei Admin-Hash-Treffer ─────────
CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin text, p_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_hashes jsonb;
  v_scope_hash text;
  v_default_hash text;
  v_match boolean := false;
  v_admin_match boolean := false;
  v_locked timestamptz;
  v_fails int;
  c_max_fails constant int := 10;
  c_lock_interval constant interval := interval '15 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;

  -- Zeile sperren: parallele Versuche für dieses Profil laufen nacheinander.
  SELECT pin_locked_until, pin_fail_count, admin_pin_hashes
    INTO v_locked, v_fails, v_hashes
    FROM profiles WHERE id = v_uid
    FOR UPDATE;

  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RETURN false;
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  IF v_hashes IS NULL OR v_hashes = '{}'::jsonb THEN
    RETURN false;
  END IF;

  v_scope_hash := v_hashes->>p_scope;
  v_default_hash := v_hashes->>'default';

  -- Strict scope: eigener Scope-Hash ist die EINZIGE Credential; default-Hash
  -- nur Fallback, solange kein Scope-Override existiert.
  IF v_scope_hash IS NOT NULL THEN
    IF v_scope_hash = extensions.crypt(p_pin, v_scope_hash) THEN
      v_match := true;
      v_admin_match := (p_scope = 'default');
    END IF;
  ELSIF v_default_hash IS NOT NULL AND v_default_hash = extensions.crypt(p_pin, v_default_hash) THEN
    v_match := true;
    v_admin_match := true;
  END IF;

  IF NOT v_match THEN
    UPDATE profiles
       SET pin_fail_count = pin_fail_count + 1,
           pin_locked_until = CASE
             WHEN pin_fail_count + 1 >= c_max_fails THEN now() + c_lock_interval
             ELSE pin_locked_until
           END
     WHERE id = v_uid;
    RETURN false;
  END IF;

  UPDATE profiles
     SET pin_fail_count = CASE WHEN v_admin_match THEN 0 ELSE pin_fail_count END,
         pin_locked_until = CASE WHEN v_admin_match THEN NULL ELSE pin_locked_until END,
         admin_pin_unlocks = COALESCE(admin_pin_unlocks, '{}'::jsonb)
                          || jsonb_build_object(p_scope, (now() + interval '5 minutes')::text)
   WHERE id = v_uid;

  RETURN true;
END;
$function$;

-- ── set_admin_pin: Sperre + Zähler + FOR UPDATE ─────────────────────────────
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
  v_admin_match boolean := false;
  v_new_hash text;
  v_settings_unlock_until text;
  v_locked timestamptz;
  v_fails int;
  c_max_fails constant int := 10;
  c_lock_interval constant interval := interval '15 minutes';
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

  SELECT pin_locked_until, pin_fail_count, admin_pin_hashes
    INTO v_locked, v_fails, v_hashes
    FROM profiles WHERE id = v_uid
    FOR UPDATE;

  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RETURN false;
  END IF;

  v_hashes := COALESCE(v_hashes, '{}'::jsonb);
  v_scope_hash := v_hashes->>p_scope;
  v_default_hash := v_hashes->>'default';

  -- Ein Scope-PIN darf erst existieren, wenn der Admin-PIN gesetzt ist.
  IF p_scope <> 'default' AND v_default_hash IS NULL THEN
    RAISE EXCEPTION 'admin pin must be set before scope pins';
  END IF;

  IF v_scope_hash IS NULL AND v_default_hash IS NULL THEN
    -- Erstkonfiguration: noch gar kein Hash, kein aktueller PIN nötig.
    v_authorized := true;
  ELSE
    -- Kein oder formal ungültiger PIN = kein Rateversuch: false ohne Zählen.
    IF p_current_pin IS NULL OR p_current_pin !~ '^[0-9]{6}$' THEN
      RETURN false;
    END IF;
    -- Aktueller Scope-PIN oder Admin-PIN autorisiert die Rotation.
    IF v_scope_hash IS NOT NULL AND v_scope_hash = extensions.crypt(p_current_pin, v_scope_hash) THEN
      v_authorized := true;
      v_admin_match := (p_scope = 'default');
    ELSIF v_default_hash IS NOT NULL AND v_default_hash = extensions.crypt(p_current_pin, v_default_hash) THEN
      v_authorized := true;
      v_admin_match := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    UPDATE profiles
       SET pin_fail_count = pin_fail_count + 1,
           pin_locked_until = CASE
             WHEN pin_fail_count + 1 >= c_max_fails THEN now() + c_lock_interval
             ELSE pin_locked_until
           END
     WHERE id = v_uid;
    RETURN false;
  END IF;

  v_new_hash := extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12));

  -- /settings nur beim Rotieren des Admin-PINs entsperren (dort lebt die UI).
  v_settings_unlock_until := CASE
    WHEN p_scope = 'default' THEN (now() + interval '5 minutes')::text
    ELSE NULL
  END;

  UPDATE profiles
  SET
    admin_pin_hashes = v_hashes || jsonb_build_object(p_scope, v_new_hash),
    -- Legacy-Spalte während des Dual-Write-Fensters spiegeln (wie bisher).
    admin_pin_hash = CASE WHEN p_scope = 'default' THEN v_new_hash ELSE admin_pin_hash END,
    admin_pin_unlocks = CASE
      WHEN v_settings_unlock_until IS NOT NULL THEN
        COALESCE(admin_pin_unlocks, '{}'::jsonb)
          || jsonb_build_object('settings', v_settings_unlock_until)
      ELSE admin_pin_unlocks
    END,
    pin_fail_count = CASE WHEN v_admin_match THEN 0 ELSE pin_fail_count END,
    pin_locked_until = CASE WHEN v_admin_match THEN NULL ELSE pin_locked_until END
  WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_pin(text, text, text) TO authenticated;

-- ── remove_admin_pin: Sperre + Zähler + FOR UPDATE ──────────────────────────
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
  v_locked timestamptz;
  v_fails int;
  c_max_fails constant int := 10;
  c_lock_interval constant interval := interval '15 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('stock') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;

  SELECT pin_locked_until, pin_fail_count, admin_pin_hashes
    INTO v_locked, v_fails, v_hashes
    FROM profiles WHERE id = v_uid
    FOR UPDATE;

  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RETURN false;
  END IF;

  v_hashes := COALESCE(v_hashes, '{}'::jsonb);
  v_default_hash := v_hashes->>'default';

  IF v_default_hash IS NULL THEN
    RETURN false;
  END IF;
  -- Kein oder formal ungültiger PIN = kein Rateversuch: false ohne Zählen.
  IF p_admin_pin IS NULL OR p_admin_pin !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  IF v_default_hash <> extensions.crypt(p_admin_pin, v_default_hash) THEN
    UPDATE profiles
       SET pin_fail_count = pin_fail_count + 1,
           pin_locked_until = CASE
             WHEN pin_fail_count + 1 >= c_max_fails THEN now() + c_lock_interval
             ELSE pin_locked_until
           END
     WHERE id = v_uid;
    RETURN false;
  END IF;

  -- Admin-Hash hat gepasst → Zähler zurücksetzen.
  UPDATE profiles
  SET admin_pin_hashes = v_hashes - p_scope,
      pin_fail_count = 0,
      pin_locked_until = NULL
  WHERE id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_admin_pin(text, text) TO authenticated;
