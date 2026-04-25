-- ============================================================================
-- Drop phone column from customers + orders
-- ============================================================================
-- Shop owner decided phone numbers aren't useful for their workflow: shops
-- are reached via WhatsApp / in person, and the field added clutter to the
-- order dialog and the customers list without ever being filled in.
--
-- - customers.phone          → dropped
-- - orders.customer_phone    → dropped (was a denormalised snapshot)
--
-- Data loss is intentional and approved — any phone numbers stored so far
-- are discarded. Not recoverable without a DB backup restore.
-- ============================================================================

ALTER TABLE public.customers
  DROP COLUMN IF EXISTS phone;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS customer_phone;
