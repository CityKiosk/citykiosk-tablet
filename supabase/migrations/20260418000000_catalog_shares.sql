-- ============================================================================
-- Public Shareable Catalog Links
-- ============================================================================
-- Allows shop owner to generate a public URL that displays the product
-- catalog as a flipbook. Anyone with the link can view — no auth required.
-- Internal dashboard remains fully protected.
-- ============================================================================

-- Share links table
CREATE TABLE catalog_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalog_shares ENABLE ROW LEVEL SECURITY;

-- Index for owner queries (list own shares)
CREATE INDEX catalog_shares_owner_id_idx ON catalog_shares(owner_id);

-- Owner policies (CRUD)
CREATE POLICY "catalog_shares_select_own"
  ON catalog_shares FOR SELECT
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "catalog_shares_insert_own"
  ON catalog_shares FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "catalog_shares_update_own"
  ON catalog_shares FOR UPDATE
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "catalog_shares_delete_own"
  ON catalog_shares FOR DELETE
  USING ((SELECT auth.uid()) = owner_id);

-- ============================================================================
-- Public catalog RPC — callable with anon key, no auth required
-- Returns products + categories for a valid share token.
-- SECURITY DEFINER bypasses RLS to read owner's data.
-- ============================================================================
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
  -- Validate token
  SELECT owner_id INTO v_owner_id
  FROM catalog_shares
  WHERE token = share_token AND is_active = true;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return products + categories (NO owner_id exposed)
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
    ) c), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant anon access to RPC (public page, no auth)
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO authenticated;
