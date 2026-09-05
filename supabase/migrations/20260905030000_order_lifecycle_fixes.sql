-- ============================================================================
-- Bestell-Lebenszyklus: zwei Korrektheitsfehler
-- ============================================================================
-- FIX 1 — next_order_number kollidiert nach dem Löschen einer NICHT-letzten
--         Bestellung. Die Nummer wurde aus count(*)+1 abgeleitet; löscht der
--         Owner z.B. INT-20260905-002 von 001/002/003, sinkt count auf 2 →
--         nächste Nummer wieder 003 → UNIQUE(owner_id, order_number)-Verletzung
--         → bis Mitternacht (Europe/Berlin) lässt sich KEINE Bestellung mehr
--         anlegen. Fix: aus dem MAXIMUM der vorhandenen Tagesnummern +1
--         ableiten (gelöschte Lücken sind egal; die höchste bleibt Referenz).
--         Der advisory-Lock (Race-Schutz) bleibt unverändert.
--
-- FIX 2 — deleteOrder stellt den Bestand nicht wieder her. Der Bestand wird
--         per AFTER-INSERT-Trigger auf order_items dekrementiert, aber beim
--         Löschen einer Bestellung (order_items per ON DELETE CASCADE) gab es
--         kein Gegenstück → verkaufte Menge blieb abgezogen, Inventar driftet.
--         Fix: spiegelbildlicher AFTER-DELETE-Trigger, der die Menge zurück-
--         bucht. order_items werden NUR per Cascade gelöscht (kein direkter
--         DELETE; authenticated hat seit 20260904010000 kein DELETE darauf),
--         also feuert der Trigger genau beim Bestell-Löschen.
-- ============================================================================

-- FIX 1 --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_date text := to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYYMMDD');
  v_next int;
  v_number text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('order_number_v1:' || v_owner::text, 0));

  -- Höchste vergebene Tagesnummer + 1 (statt count+1). Der numerische Suffix
  -- wird aus dem order_number extrahiert; gelöschte Lücken bleiben frei, die
  -- Sequenz kollidiert nicht mehr mit einer bestehenden Nummer.
  SELECT COALESCE(MAX(substring(order_number from '(\d+)$')::int), 0) + 1
    INTO v_next
    FROM public.orders
   WHERE owner_id = v_owner
     AND order_number LIKE 'INT-' || v_date || '-%';

  v_number := 'INT-' || v_date || '-' || lpad(v_next::text, 3, '0');
  RETURN v_number;
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO authenticated;

-- FIX 2 --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Spiegelbild von decrement_product_stock: gelöschte verkaufte Menge zurück.
  -- product_id kann NULL sein (Produkt nach Snapshot gelöscht) → überspringen.
  IF old.product_id IS NOT NULL THEN
    UPDATE public.products
       SET stock = stock + old.quantity,
           updated_at = now()
     WHERE id = old.product_id
       AND owner_id = old.owner_id;
  END IF;
  RETURN old;
END;
$$;

DROP TRIGGER IF EXISTS order_items_restore_stock ON public.order_items;

CREATE TRIGGER order_items_restore_stock
  AFTER DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_product_stock();
