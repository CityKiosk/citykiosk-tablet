-- Order-level percentage discount (0-20 %). Owner can apply this from the
-- cart sheet via a long-press on the GESAMT label, gated behind the admin
-- PIN. `total`, `tax_amount`, `gross_total` are stored AFTER the discount is
-- applied so legacy queries that sum `gross_total` for revenue keep working
-- without further changes.
--
-- `discount_amount` is materialised on insert so PDF export and the orders
-- detail view do not have to recompute (subtotal − total) themselves and so
-- the original list price is recoverable for the receipt.

ALTER TABLE public.orders
  ADD COLUMN discount_pct    smallint        NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount numeric(10, 2)  NOT NULL DEFAULT 0;

-- Defensive cap matches the UI (max 20 %). Owner shouldn't be able to set
-- a higher value even if a server-side validation regression slips by.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_pct_range CHECK (discount_pct >= 0 AND discount_pct <= 20),
  ADD CONSTRAINT orders_discount_amount_nonneg CHECK (discount_amount >= 0);

COMMENT ON COLUMN public.orders.discount_pct IS
  'Order-level discount percentage applied to the net subtotal. 0..20.';
COMMENT ON COLUMN public.orders.discount_amount IS
  'EUR value of the discount applied (subtotal × discount_pct / 100). Stored so PDF/UI do not have to recompute.';
