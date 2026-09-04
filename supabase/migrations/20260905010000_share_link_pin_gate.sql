-- ============================================================================
-- catalog_shares: Verwaltung hinter den Settings-PIN (threat-model K1)
-- ============================================================================
-- Der Teilen-Button lebt auf dem kundenseitigen /browse-Screen und rief
-- getOrCreateShareLink ohne jeden PIN. authenticated hat volles CRUD auf
-- catalog_shares → ein Kunde am Tablet konnte per direktem PostgREST
-- `POST /rest/v1/catalog_shares {}` einen PERMANENTEN öffentlichen
-- Katalog-Link (/v/<token>) erzeugen, den vorhandenen Token per SELECT
-- auslesen oder per PATCH is_active=false den Link des Owners abschalten —
-- alles ohne Wissen des Owners und ohne Widerrufsmöglichkeit.
--
-- Fix: RLS für SELECT/INSERT/UPDATE/DELETE zusätzlich an
-- is_admin_pin_unlocked('settings') binden. Der öffentliche Lesepfad läuft
-- über get_public_catalog (SECURITY DEFINER, umgeht RLS) und bleibt davon
-- unberührt — /v/<token> funktioniert weiter. Die legitime App entsperrt
-- 'settings' vor dem Teilen (PIN-Dialog), daher keine Regression.
-- ============================================================================

DROP POLICY IF EXISTS "catalog_shares_select_own" ON catalog_shares;
DROP POLICY IF EXISTS "catalog_shares_insert_own" ON catalog_shares;
DROP POLICY IF EXISTS "catalog_shares_update_own" ON catalog_shares;
DROP POLICY IF EXISTS "catalog_shares_delete_own" ON catalog_shares;

CREATE POLICY "catalog_shares_select_own"
  ON catalog_shares FOR SELECT
  USING ((SELECT auth.uid()) = owner_id AND is_admin_pin_unlocked('settings'));

CREATE POLICY "catalog_shares_insert_own"
  ON catalog_shares FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = owner_id AND is_admin_pin_unlocked('settings'));

CREATE POLICY "catalog_shares_update_own"
  ON catalog_shares FOR UPDATE
  USING ((SELECT auth.uid()) = owner_id AND is_admin_pin_unlocked('settings'))
  WITH CHECK ((SELECT auth.uid()) = owner_id AND is_admin_pin_unlocked('settings'));

CREATE POLICY "catalog_shares_delete_own"
  ON catalog_shares FOR DELETE
  USING ((SELECT auth.uid()) = owner_id AND is_admin_pin_unlocked('settings'));
