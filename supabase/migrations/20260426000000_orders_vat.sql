-- ============================================================================
-- German VAT (MwSt) on orders
-- ============================================================================
-- Wholesale (B2B) net pricing: products.price stays net (KDV hariç).
-- Each order now stamps the VAT rate that applied at the time of creation,
-- so future rate changes don't retroactively rewrite invoices.
--
-- Three new columns:
--   tax_rate    — percent applied (e.g. 19 for the German standard rate)
--   tax_amount  — euro VAT amount (round(total * tax_rate / 100, 2))
--   gross_total — total + tax_amount; what the customer actually pays
--
-- Backfill: existing orders predate the VAT rollout. We mark them with
-- tax_rate=0/tax_amount=0/gross_total=total so the UI shows no breakdown
-- (the old `total` was already the final billed figure, never net).
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_rate    numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount  numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_total numeric(10,2) NOT NULL DEFAULT 0;

-- Legacy backfill — for any pre-existing row, the old total was the final
-- amount with no separate VAT line. Keep that semantics by carrying it
-- into gross_total and leaving tax_rate/tax_amount at zero.
UPDATE public.orders
SET gross_total = total
WHERE gross_total = 0;

-- Sanity check — gross_total must equal total + tax_amount within rounding.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_gross_total_consistent
  CHECK (abs(gross_total - (total + tax_amount)) < 0.01);
