-- ============================================================================
-- Add email + phone contact fields to customers
-- ============================================================================
-- The shop owner now wants contact details on customer records. Phone was
-- previously dropped (20260425000000_drop_customer_phone) because it was unused
-- at the time; it is reintroduced here together with a new email field.
--
-- Both columns are optional free-text (nullable). Existing rows keep NULL.
-- This is an additive, non-destructive change — no data loss, no backfill.
--
-- Email format is validated in the application layer (Zod, same as auth flows);
-- phone is stored verbatim (international formats vary too much to constrain).
--
-- No RLS change required: the existing customers_{select,insert,update,delete}_own
-- policies are row-scoped (owner_id = auth.uid()) and cover all columns.
-- ============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.customers.email IS 'Optional contact email (format validated app-side).';
COMMENT ON COLUMN public.customers.phone IS 'Optional contact phone (free text, no format constraint).';
