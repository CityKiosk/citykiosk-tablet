-- ============================================================================
-- Step 1 of TR removal — relax NOT NULL on TR columns
-- ============================================================================
-- Pre-deploy migration. New frontend code stops writing name_tr /
-- product_name_tr in INSERTs; without this relax-NOT-NULL step, those
-- inserts would fail on the still-existing constraints during the deploy
-- window (and forever, if we forgot).
--
-- Step 2 (drop columns + tighten name_de NOT NULL) lives in a follow-up
-- migration applied AFTER the new code is live, so old code in flight
-- during the Render deploy can still write its TR pair successfully.
-- ============================================================================

ALTER TABLE public.products    ALTER COLUMN name_tr        DROP NOT NULL;
ALTER TABLE public.categories  ALTER COLUMN name_tr        DROP NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN product_name_tr DROP NOT NULL;
