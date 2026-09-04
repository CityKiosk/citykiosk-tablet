-- ============================================================================
-- update_display_field: Settings-PIN im RPC erzwingen (threat-model K1/K4)
-- ============================================================================
-- Die RPC prüfte nur auth.uid(), keinen PIN. EXECUTE ist an authenticated
-- vergeben → ein Kunde am geteilten Tablet konnte per direktem PostgREST-Call
-- `POST /rest/v1/rpc/update_display_field {"p_scope":"browse","p_key":"price",
-- "p_value":true}` die im /browse- UND im öffentlichen /v/<token>-Katalog
-- ausgeblendeten Felder (Preis, SKU, …) wieder einschalten — unter Umgehung
-- des Settings-PIN (der nur in der Server-Action updateDisplayField per
-- requirePinUnlocked('settings') greift, was PostgREST überspringt).
--
-- Fix: dieselbe Prüfung IN die SECURITY-DEFINER-RPC ziehen. is_admin_pin_unlocked
-- ist SECURITY DEFINER und liest den Unlock-Stamp desselben auth.uid() — die
-- legitime Server-Action entsperrt 'settings' vorher (requirePinUnlocked), also
-- kein Regressions­risiko; ein direkter PostgREST-Call ohne Unlock schlägt fehl.
-- Verhalten spiegelt exakt die App-Schicht (requirePinUnlocked liefert bei
-- fehlendem/abgelaufenem Unlock ebenfalls einen Fehler).
-- ============================================================================

CREATE OR REPLACE FUNCTION update_display_field(p_scope text, p_key text, p_value boolean)
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
  -- DB-seitiges PIN-Gate: Anzeigefelder sind ein Admin-Setting (Settings-PIN).
  IF NOT is_admin_pin_unlocked('settings') THEN
    RAISE EXCEPTION 'settings pin required';
  END IF;
  IF p_scope NOT IN ('catalog','browse') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;
  IF p_key NOT IN ('name','description','sku','dimensions','price','packagingUnit') THEN
    RAISE EXCEPTION 'invalid key';
  END IF;

  IF p_scope = 'catalog' THEN
    UPDATE profiles
    SET display_fields_catalog = COALESCE(display_fields_catalog, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
    WHERE id = v_uid;
  ELSE
    UPDATE profiles
    SET display_fields_browse = COALESCE(display_fields_browse, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
    WHERE id = v_uid;
  END IF;
END;
$$;
