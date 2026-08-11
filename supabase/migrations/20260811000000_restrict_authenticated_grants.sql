-- ============================================================================
-- Security hardening M2: authenticated-Rolle einschränken
-- ============================================================================
-- Befund (Audit 2026-08-11, live verifiziert):
--
--   20260425010000_security_hardening.sql hat Supabases Default-CRUD-Grants nur
--   von `anon` entzogen. `authenticated` behielt auf allen Tabellen volle Rechte
--   (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) — live bestätigt
--   via information_schema.role_table_grants.
--
--   Das hebelt die gesamte PIN-Architektur aus: der Sperrzustand liegt in
--   profiles.admin_pin_unlocks, und RLS wirkt zeilen-, nicht spaltenweise.
--   "profiles_update_own" erlaubt UPDATE auf die eigene Zeile — inklusive der
--   PIN-Spalten. Da @supabase/ssr das Auth-Cookie mit httpOnly:false schreibt,
--   kann der Kunde am geteilten Tablet das Token aus der Konsole lesen und per
--   PostgREST direkt schreiben:
--
--     PATCH /rest/v1/profiles?id=eq.<uid>
--     { "admin_pin_unlocks": { "settings": "2999-01-01T00:00:00Z", ... } }
--
--   → requirePinUnlocked() gibt an allen 19 Aufrufstellen true zurück, ohne
--   dass je eine PIN eingegeben wurde. Analog kann admin_pin_hashes gelesen
--   (bcrypt-Hash offline knackbar) oder überschrieben werden.
--
--   Dasselbe gilt für app_sessions: das 6-Geräte-Limit wird in register_session
--   geprüft, die Tabelle ist aber direkt beschreibbar.
--
-- Warum das ohne Code-Änderung geht:
--
--   Die App schreibt nie nach profiles. Einziger Zugriff ist ein SELECT auf zwei
--   Spalten (settings/actions.ts:41-45, aufgerufen aus (dashboard)/layout.tsx:29).
--   Auf app_sessions gibt es nur ein DELETE beim Logout (logout/actions.ts:20).
--
--   Alle übrigen Zugriffe laufen über SECURITY DEFINER-Funktionen. Es sind 13,
--   nicht die neun aus einer früheren Fassung dieses Kommentars:
--     profiles      handle_new_user, get_public_catalog, has_admin_pin,
--                   has_admin_pin_for_scope, verify_admin_pin, set_admin_pin,
--                   remove_admin_pin, is_admin_pin_unlocked,
--                   extend_admin_pin_unlock, lock_admin_pin,
--                   update_display_field, register_session (SELECT FOR UPDATE)
--     app_sessions  register_session, touch_session
--   Alle 39 CREATE FUNCTION der Migrationshistorie sind SECURITY DEFINER; es
--   gibt keine einzige INVOKER-Funktion, die diese Tabellen anfasst.
--
--   Dass DEFINER hier trägt, ist nicht bloss Theorie: 20260425010000 hat `anon`
--   sämtliche Rechte auf profiles entzogen — SELECT eingeschlossen. Trotzdem
--   liest get_public_catalog seit April profiles.display_fields_browse für
--   anonyme Besucher (/v/[token] und der Keep-alive-Ping laufen darüber). Der
--   Mechanismus ist also produktiv erprobt, nur bisher für die andere Rolle.
--
--   Foreign Keys bleiben ebenfalls unberührt: sechs FKs zeigen auf profiles(id)
--   (categories/products/customers/orders/order_items.owner_id, app_sessions
--   .user_id). PostgreSQLs RI-Trigger laufen mit den Rechten der referenzierten
--   Tabelle, nicht des Aufrufers; REFERENCES wird nur beim CREATE CONSTRAINT
--   geprüft, nicht bei jedem INSERT. Zudem steht `id` ohnehin im GRANT.
--
-- Nicht Teil dieser Migration:
--
--   products / categories / customers / orders / order_items / catalog_shares
--   behalten ihre authenticated-Grants — die App nutzt sie direkt. Diese
--   einzuschränken hieße, sämtliche Mutationen in RPCs zu verlagern; das ist
--   eine separate Umstellung.
-- ============================================================================

-- ── 1. profiles: Schreibrechte vollständig entziehen ────────────────────────
-- TRUNCATE ist bewusst dabei: TRUNCATE umgeht RLS komplett (derselbe Grund,
-- aus dem es in 20260425010000 auch `anon` entzogen wurde).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM authenticated;

-- ── 2. profiles: SELECT auf Spaltenebene begrenzen ──────────────────────────
-- Ausgeschlossen bleiben die drei PIN-Spalten:
--   admin_pin_hash    (Legacy, seit 20260502024515 nach admin_pin_hashes
--                      migriert — kann in einer eigenen Migration entfallen)
--   admin_pin_hashes  (bcrypt, cost 12)
--   admin_pin_unlocks (Sperrzustand)
-- Diese sind danach ausschließlich über SECURITY DEFINER-RPCs erreichbar.

REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id,
  display_name,
  shop_name,
  shop_address,
  shop_phone,
  shop_email,
  locale,
  display_fields_catalog,
  display_fields_browse,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

-- ── 3. app_sessions: nur SELECT + DELETE behalten ───────────────────────────
-- DELETE wird vom Logout gebraucht; INSERT/UPDATE laufen ausschließlich über
-- register_session / touch_session und sind dort ans Gerätelimit gekoppelt.

REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER
  ON public.app_sessions FROM authenticated;

-- ── 4. Künftige Tabellen erben den Default-Grant nicht mehr ─────────────────
-- Gilt nur für Tabellen, die von der ausführenden Rolle erzeugt werden —
-- dasselbe Muster wie in 20260425010000 für `anon`.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;

-- ============================================================================
-- ACHTUNG — zwei Dinge ändern sich dauerhaft für künftige Migrationen
-- ============================================================================
-- (a) NEUE TABELLE  → braucht ein explizites
--       GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabelle> TO authenticated;
--     sonst ist sie für die App unsichtbar. Bisher kam das automatisch über
--     Supabases Default-Privileges; im ganzen Projekt gibt es deshalb noch
--     keinen einzigen expliziten Table-GRANT. Das ist die erste Migration,
--     die gegen diese Gewohnheit läuft.
--
-- (b) NEUE SPALTE IN profiles → braucht ein explizites
--       GRANT SELECT (<spalte>) ON public.profiles TO authenticated;
--     Bei spaltenweisen Grants deckt ADD COLUMN die neue Spalte NICHT ab.
--     Das ist gewollt (eine künftige PIN-artige Spalte soll nicht versehentlich
--     lesbar werden), aber ohne dieses Wissen sucht man den Fehler lange.
--     Betrifft nur profiles — customers/orders/products behalten Table-Grants.
--
-- Nicht enthalten: REVOKE MAINTAIN (PG17+). GRANT ALL schliesst dort MAINTAIN
-- ein (VACUUM/ANALYZE/REINDEX). Kein Datenzugriff, daher kein Sicherheitsleck;
-- wer es sauber will, prüft `SHOW server_version;` und ergänzt es — auf PG16
-- wirft die Anweisung einen Fehler.
-- ============================================================================

-- ============================================================================
-- Verifikation nach dem Deploy
-- ============================================================================
-- Erwartet: profiles → gar keine Zeile mehr für 'authenticated' in
-- role_table_grants (spaltenweise Grants stehen in column_privileges);
-- app_sessions → nur SELECT und DELETE.
--
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'authenticated'
--      and table_name in ('profiles','app_sessions')
--    order by table_name, privilege_type;
--
--   select table_name, column_name, privilege_type
--     from information_schema.column_privileges
--    where table_schema = 'public' and grantee = 'authenticated'
--      and table_name = 'profiles'
--    order by column_name;
--
-- Danach in der App prüfen — die ersten fünf decken die betroffenen Pfade ab,
-- die letzten beiden sind die Stellen, an denen es am knappsten war:
--   1. Login und Logout            (register_session / app_sessions DELETE)
--   2. Settings öffnen             (fetchDisplayFields — läuft bei JEDEM
--                                   Dashboard-Request über layout.tsx:29)
--   3. PIN setzen / prüfen / entsperren
--   4. Bestellung anlegen          (FK-Prüfung gegen profiles)
--   5. Neuen Kunden anlegen
--   6. Login vom ZWEITEN Gerät     (register_session macht SELECT ... FOR
--                                   UPDATE auf profiles — der Pfad, der einem
--                                   UPDATE-Recht am nächsten kommt)
--   7. /v/<token> öffnen           (get_public_catalog liest profiles als anon)
--
-- Rollback (nur im Notfall — stellt die Lücke wieder her):
--   GRANT ALL ON public.profiles, public.app_sessions TO authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- ============================================================================
