-- ============================================================================
-- Security hardening M3: PIN-Brute-Force-Sperre (DB-seitig) + Storage-Listing zu
-- ============================================================================
-- Zwei live-verifizierte HIGH-Befunde des Audits 2026-08:
--
-- HIGH-1 — PIN Brute-Force: verify_admin_pin hat KEINEN Zähler/Lockout. Das
--   App-Rate-Limit (5/min, in-memory) wird umgangen, weil authenticated die RPC
--   direkt über PostgREST aufrufen kann. 6-stellige PIN (10^6) mit bcrypt cost 12
--   ist so mit paralleler Last angreifbar. Fix: Zähler + Sperre IN der RPC
--   (SECURITY DEFINER → der Client kann die Spalten nicht manipulieren, zumal
--   M2 profiles-Schreibrechte von authenticated ohnehin entzogen hat).
--
-- HIGH-2 — Storage Anon-Listing: public_read_product_images (TO public) erlaubt
--   anonymes list() auf den Bucket. Live bestätigt: ein anonymer Aufruf listet
--   die owner-UUID-Ordner. Der Bucket ist public=true, DOWNLOAD funktioniert also
--   ohne diese Policy weiter; die Policy fügt nur das LISTEN hinzu (Enumeration
--   versteckter/inaktiver Produktbilder + Offenlegung der owner-UUID). Fix:
--   Policy droppen; optional authentifiziertes Listen des EIGENEN Ordners.
-- ============================================================================

-- ── HIGH-1: Brute-Force-Sperre ──────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_fail_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

-- authenticated darf diese Spalten NICHT direkt schreiben (M2 hat UPDATE bereits
-- entzogen; das SELECT-Column-Grant deckt sie nicht ab → bleiben unlesbar).
-- Nur die SECURITY-DEFINER-RPC unten schreibt sie.

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
  v_locked timestamptz;
  v_fails int;
  -- Lockout-Parameter: ab 10 Fehlversuchen 15 min sperren.
  c_max_fails constant int := 10;
  c_lock_interval constant interval := interval '15 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('settings', 'stock', 'orders', 'customers') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;

  -- Sperre prüfen BEVOR gerechnet wird (bcrypt ist teuer; Sperre schützt auch
  -- die DB-CPU). Gesperrt → sofort false, ohne Vergleich.
  SELECT pin_locked_until, pin_fail_count, admin_pin_hashes
    INTO v_locked, v_fails, v_hashes
    FROM profiles WHERE id = v_uid;

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
    END IF;
  ELSIF v_default_hash IS NOT NULL AND v_default_hash = extensions.crypt(p_pin, v_default_hash) THEN
    v_match := true;
  END IF;

  IF NOT v_match THEN
    -- Fehlversuch zählen; ab Schwelle sperren.
    UPDATE profiles
       SET pin_fail_count = pin_fail_count + 1,
           pin_locked_until = CASE
             WHEN pin_fail_count + 1 >= c_max_fails THEN now() + c_lock_interval
             ELSE pin_locked_until
           END
     WHERE id = v_uid;
    RETURN false;
  END IF;

  -- Erfolg: Zähler zurücksetzen + Unlock-Fenster setzen.
  UPDATE profiles
     SET pin_fail_count = 0,
         pin_locked_until = NULL,
         admin_pin_unlocks = COALESCE(admin_pin_unlocks, '{}'::jsonb)
                          || jsonb_build_object(p_scope, (now() + interval '5 minutes')::text)
   WHERE id = v_uid;

  RETURN true;
END;
$function$;

-- ── HIGH-2: Anonymes Storage-Listing schließen ──────────────────────────────
-- Download läuft weiter über bucket public=true; diese Policy gab nur das
-- Listen frei. Ersatz: nur authentifiziertes Listen des eigenen Ordners
-- (owner = auth.uid()) — falls die App je serverseitig listen muss.

DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;

CREATE POLICY "auth_list_own_product_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());

-- ============================================================================
-- Verifikation nach Deploy:
--   -- Brute-Force: 10x falsche PIN → 11. Versuch bleibt false auch bei
--      RICHTIGER PIN (gesperrt); pin_locked_until in der Zukunft.
--      select pin_fail_count, pin_locked_until from profiles where id = auth.uid();
--   -- Anon-Listing: POST /storage/v1/object/list/product-images mit anon key
--      liefert jetzt [] statt der owner-UUID-Ordner. Download einer bekannten
--      URL funktioniert weiter (bucket public).
-- App-Test: PIN eingeben (Erfolg), 10x falsch (Sperre), Produktbild lädt.
-- ============================================================================
