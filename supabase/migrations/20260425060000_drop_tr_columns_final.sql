-- ============================================================================
-- Step 2 of TR removal — drop the columns and lock DE in
-- ============================================================================
-- Apply ONLY after the DE-only frontend is live (Render deploy succeeded).
-- Old code in flight will still try to write name_tr; this migration drops
-- the column out from under it, so anything still serving the previous
-- bundle will 500 on inserts. That is intentional — the TR write path is
-- gone, no half-state.
--
-- The original migration 20260425050000 just relaxed NOT NULL so the new
-- code's INSERTs (which omit name_tr) didn't fail during the deploy
-- window. After this migration:
--   - TR columns gone forever (data non-recoverable).
--   - name_de / product_name_de pinned NOT NULL — the single source of
--     truth for product naming.
--   - Legacy single-scope `display_fields` JSONB on profiles dropped — it
--     was kept "for rollback safety" since 20260424140000; nothing reads
--     it any more.
--   - get_public_catalog rewritten to match the new shape.
-- ============================================================================

-- 1. name_de becomes the NOT NULL anchor.
ALTER TABLE public.products
  ALTER COLUMN name_de SET NOT NULL;
ALTER TABLE public.categories
  ALTER COLUMN name_de SET NOT NULL;
ALTER TABLE public.order_items
  ALTER COLUMN product_name_de SET NOT NULL;

-- 2. Drop the TR columns.
ALTER TABLE public.products
  DROP COLUMN IF EXISTS name_tr,
  DROP COLUMN IF EXISTS description_tr;

ALTER TABLE public.categories
  DROP COLUMN IF EXISTS name_tr;

ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS product_name_tr;

-- 3. Drop the legacy display_fields column.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS display_fields;

-- 4. RPC update — return shape no longer includes TR fields.
CREATE OR REPLACE FUNCTION get_public_catalog(share_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
  v_fields jsonb;
  v_show_description boolean;
  v_show_sku boolean;
  v_show_dimensions boolean;
  v_show_price boolean;
  v_show_packaging boolean;
  result json;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM catalog_shares
  WHERE token = share_token AND is_active = true;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    display_fields_browse,
    '{"name":true,"description":true,"sku":true,"dimensions":true,"price":true,"packagingUnit":true}'::jsonb
  ) INTO v_fields
  FROM profiles WHERE id = v_owner_id;

  v_show_description := COALESCE((v_fields->>'description')::boolean, true);
  v_show_sku         := COALESCE((v_fields->>'sku')::boolean, true);
  v_show_dimensions  := COALESCE((v_fields->>'dimensions')::boolean, true);
  v_show_price       := COALESCE((v_fields->>'price')::boolean, true);
  v_show_packaging   := COALESCE((v_fields->>'packagingUnit')::boolean, true);

  SELECT json_build_object(
    'products', COALESCE((SELECT json_agg(p ORDER BY p.sort_order) FROM (
      SELECT
        id,
        name_de,
        CASE WHEN v_show_price       THEN price          ELSE NULL END AS price,
        image_url,
        category_id,
        CASE WHEN v_show_dimensions  THEN dimensions     ELSE NULL END AS dimensions,
        CASE WHEN v_show_packaging   THEN packaging_unit ELSE NULL END AS packaging_unit,
        CASE WHEN v_show_sku         THEN sku            ELSE NULL END AS sku,
        CASE WHEN v_show_description THEN description_de ELSE NULL END AS description_de,
        sort_order
      FROM products
      WHERE owner_id = v_owner_id AND is_active = true
    ) p), '[]'::json),
    'categories', COALESCE((SELECT json_agg(c ORDER BY c.name_de) FROM (
      SELECT id, slug, name_de, sort_order
      FROM categories
      WHERE owner_id = v_owner_id AND is_active = true
    ) c), '[]'::json),
    'display_fields', v_fields
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO authenticated;
