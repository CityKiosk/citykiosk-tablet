-- ============================================================================
-- Display Fields (cross-device + public share link)
-- ============================================================================
-- Owner controls which product fields appear in the dashboard and in the
-- public flipbook (/v/[token]). Previously stored in localStorage (per-device,
-- not applied to public link). Now stored per-owner in profiles.display_fields.
-- ============================================================================

-- 1. Default preset (used by migration default, RPC fallback, client fallback)
-- All fields visible for new/existing owners.
ALTER TABLE public.profiles
  ADD COLUMN display_fields jsonb NOT NULL DEFAULT '{"name":true,"description":true,"sku":true,"dimensions":true,"price":true,"packagingUnit":true}'::jsonb;

-- 2. Public RPC now returns owner's display_fields along with products/categories.
-- coalesce() guards against a profiles row without display_fields (should never
-- happen because of the NOT NULL DEFAULT, but defensive for future JSON nulls).
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
      (SELECT display_fields FROM profiles WHERE id = v_owner_id),
      '{"name":true,"description":true,"sku":true,"dimensions":true,"price":true,"packagingUnit":true}'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO authenticated;

-- 3. Partial-merge update function.
-- Overwriting display_fields entirely from the client would introduce a race:
-- two devices toggling different keys concurrently would lose one write.
-- This function merges a single {key: value} on the server side atomically.
CREATE OR REPLACE FUNCTION update_display_field(p_key text, p_value boolean)
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
  IF p_key NOT IN ('name','description','sku','dimensions','price','packagingUnit') THEN
    RAISE EXCEPTION 'invalid key';
  END IF;
  -- Name is always visible.
  IF p_key = 'name' AND p_value = false THEN
    RAISE EXCEPTION 'name field is locked';
  END IF;

  UPDATE profiles
  SET display_fields = COALESCE(display_fields, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_display_field(text, boolean) TO authenticated;
