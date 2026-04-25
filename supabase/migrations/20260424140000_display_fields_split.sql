-- ============================================================================
-- Split display_fields into per-view configs: catalog + browse (vitrin)
-- ============================================================================
-- Previously one JSONB column applied the same "show/hide" rules to both the
-- owner-facing catalog (/catalog) and the customer-facing showcase (/browse,
-- vitrin) + public share link (/v/[token]). These audiences have different
-- needs — e.g. owner wants to see SKU while pricing an order, customer only
-- needs name + price on the showcase — so we split the config.
--
-- Migration strategy:
--   1. Add two new columns, both defaulting to "all fields visible".
--   2. Copy existing display_fields into both columns so nobody loses their
--      current setting (whichever view they'd last tuned applies to both).
--   3. Update update_display_field RPC to take a scope parameter.
--   4. Update get_public_catalog RPC to return the `browse` scope
--      (public links are customer-facing = vitrin = browse).
--   5. Keep the old display_fields column for now — rollback safety. Can be
--      dropped in a later migration once the split has been running for a
--      while.
-- ============================================================================

-- 1. New columns.
ALTER TABLE public.profiles
  ADD COLUMN display_fields_catalog jsonb NOT NULL DEFAULT '{"name":true,"description":true,"sku":true,"dimensions":true,"price":true,"packagingUnit":true}'::jsonb,
  ADD COLUMN display_fields_browse jsonb NOT NULL DEFAULT '{"name":true,"description":true,"sku":true,"dimensions":true,"price":true,"packagingUnit":true}'::jsonb;

-- 2. Preserve each owner's current configuration by copying into both scopes.
UPDATE public.profiles
SET
  display_fields_catalog = display_fields,
  display_fields_browse = display_fields;

-- 3. Drop + recreate update_display_field with a scope parameter.
-- (CREATE OR REPLACE would keep the old 2-arg overload around.)
DROP FUNCTION IF EXISTS public.update_display_field(text, boolean);

CREATE OR REPLACE FUNCTION update_display_field(p_scope text, p_key text, p_value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_scope NOT IN ('catalog','browse') THEN
    RAISE EXCEPTION 'invalid scope';
  END IF;
  IF p_key NOT IN ('name','description','sku','dimensions','price','packagingUnit') THEN
    RAISE EXCEPTION 'invalid key';
  END IF;
  -- Name is always visible.
  IF p_key = 'name' AND p_value = false THEN
    RAISE EXCEPTION 'name field is locked';
  END IF;

  -- Branch rather than building dynamic SQL — keeps the identifier out of
  -- user-controlled input, avoids any format()/EXECUTE risk.
  IF p_scope = 'catalog' THEN
    UPDATE profiles
    SET display_fields_catalog = COALESCE(display_fields_catalog, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
    WHERE id = v_uid;
  ELSE
    UPDATE profiles
    SET display_fields_browse = COALESCE(display_fields_browse, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
    WHERE id = v_uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_display_field(text, text, boolean) TO authenticated;

-- 4. Public share link returns browse-scope fields.
-- Customer-facing = vitrin = browse. The owner's catalog settings stay private.
CREATE OR REPLACE FUNCTION get_public_catalog(share_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
  result json;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM catalog_shares
  WHERE token = share_token AND is_active = true;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'products', COALESCE((SELECT json_agg(p ORDER BY p.sort_order) FROM (
      SELECT id, name_tr, name_de, price, image_url, category_id,
             dimensions, packaging_unit, sku, description_tr, description_de, sort_order
      FROM products
      WHERE owner_id = v_owner_id AND is_active = true
    ) p), '[]'::json),
    'categories', COALESCE((SELECT json_agg(c ORDER BY c.name_de) FROM (
      SELECT id, slug, name_tr, name_de, sort_order
      FROM categories
      WHERE owner_id = v_owner_id AND is_active = true
    ) c), '[]'::json),
    'display_fields', COALESCE(
      (SELECT display_fields_browse FROM profiles WHERE id = v_owner_id),
      '{"name":true,"description":true,"sku":true,"dimensions":true,"price":true,"packagingUnit":true}'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO authenticated;
