-- ============================================================================
-- authenticated: ungenutzte destruktive Grants auf Business-Tabellen entziehen
-- ============================================================================
-- threat-model K2: Supabase gibt `authenticated` per Default volles CRUD auf
-- jede Public-Tabelle. Am geteilten Tablet kann der Kunde mit dem Owner-Token
-- direkt per PostgREST auf diese Tabellen schreiben — unter Umgehung von
-- PinGate/requirePinUnlocked (die nur in der App-Schicht greifen).
--
-- Dieser Schritt entzieht NUR Rechte, die die App NACHWEISLICH NIE nutzt —
-- also kein Funktionsverlust, keine RPC-Umstellung nötig:
--
--   • customers: DELETE  → die App löscht Kunden ausschließlich SOFT
--     (UPDATE is_active=false, settings/actions.ts:263). Ein direktes
--     DELETE /rest/v1/customers (permanente Löschung von Kunden-PII, DSGVO-
--     relevant) wird damit unmöglich. UPDATE bleibt (Soft-Delete + Bearbeiten).
--   • order_items: DELETE → die App löscht order_items nie direkt; sie
--     verschwinden nur per ON DELETE CASCADE mit der orders-Zeile. Kaskaden
--     laufen mit den Rechten des Tabellen-Owners, NICHT des aufrufenden Rollen —
--     der Entzug bricht die Kaskade also nicht.
--   • TRUNCATE auf allen Business-Tabellen → TRUNCATE umgeht RLS komplett und
--     wird von der App nie benutzt. Die August-Härtung entzog es `anon`, aber
--     nicht `authenticated` (K5-Lücke). PostgREST kann TRUNCATE zwar ohnehin
--     nicht auslösen, aber der Entzug ist saubere Defense-in-Depth.
--
-- NICHT hier behandelt (brauchen eine RPC-/RLS-Umstellung, separat geplant):
--   products.stock/price-Lesen+Ändern ohne PIN, customers-PII-Lesen +
--   is_active-Resurrect, orders-Historie lesen + löschen, Rabatt-Tampering.
-- ============================================================================

REVOKE DELETE ON public.customers    FROM authenticated;
REVOKE DELETE ON public.order_items  FROM authenticated;

REVOKE TRUNCATE ON
    public.products,
    public.categories,
    public.customers,
    public.orders,
    public.order_items,
    public.catalog_shares
  FROM authenticated;
