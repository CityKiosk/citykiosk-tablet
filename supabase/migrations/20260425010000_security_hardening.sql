-- ============================================================================
-- Security Hardening — combined fixes for H3, H4, M2, M6
-- ============================================================================
-- H3: get_public_catalog must respect display_fields_browse — currently sends
--     price/sku/description/dimensions/packaging_unit to the wire even when
--     toggled off, exposing them via View-Source despite the frontend hiding.
-- H4: Revoke permissive default grants from `anon` on public schema. RLS
--     blocks data access, but anon should not even hold INSERT/UPDATE/DELETE/
--     TRUNCATE/REFERENCES — defense-in-depth.
-- M2: product-images bucket has no MIME or size limit — auth'd user can upload
--     arbitrary blobs. Cap MIME to image types and size to 2 MB.
-- M6: next_order_number uses count(*)+1 with no advisory lock — concurrent
--     orders can collide on the unique (owner, order_number) constraint.
-- ============================================================================

-- ── H3: payload-level field filtering in get_public_catalog ───────────────
-- Conditional json_build_object: when a field is toggled OFF in
-- display_fields_browse, the RPC sends NULL for that field instead of the
-- real value. Frontend already tolerates null fields — name stays visible.
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
        name_tr,
        name_de,
        CASE WHEN v_show_price       THEN price          ELSE NULL END AS price,
        image_url,
        category_id,
        CASE WHEN v_show_dimensions  THEN dimensions     ELSE NULL END AS dimensions,
        CASE WHEN v_show_packaging   THEN packaging_unit ELSE NULL END AS packaging_unit,
        CASE WHEN v_show_sku         THEN sku            ELSE NULL END AS sku,
        CASE WHEN v_show_description THEN description_tr ELSE NULL END AS description_tr,
        CASE WHEN v_show_description THEN description_de ELSE NULL END AS description_de,
        sort_order
      FROM products
      WHERE owner_id = v_owner_id AND is_active = true
    ) p), '[]'::json),
    'categories', COALESCE((SELECT json_agg(c ORDER BY c.name_de) FROM (
      SELECT id, slug, name_tr, name_de, sort_order
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

-- ── H4: revoke permissive default grants from anon ────────────────────────
-- Supabase ships every public table with full CRUD grants to anon by default.
-- RLS guards the data, but anon should never hold these privileges. RLS only
-- protects rows; TRUNCATE bypasses RLS entirely. Lock anon out at the grant
-- level so a future RLS misconfig can't cascade into a wipe.
--
-- catalog_shares is intentionally excluded from the SELECT revoke because
-- its public consumption goes through get_public_catalog (SECURITY DEFINER)
-- — anon never queries the table directly, so no SELECT grant needed either.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, SELECT
  ON public.products, public.categories, public.customers,
     public.orders, public.order_items, public.profiles, public.catalog_shares
  FROM anon;

-- Future tables created in `public` schema: stop the default grant cascade.
-- (Supabase's `default privileges` for postgres role grants to anon — undo it.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

-- ── M2: storage bucket size + MIME constraints ────────────────────────────
-- Public bucket; auth'd users upload via direct PUT. Without these caps, the
-- bucket is an open file-store for arbitrary blobs once a user is signed in.
UPDATE storage.buckets
SET
  file_size_limit = 2097152, -- 2 MiB; client resizes to 800px JPEG ~150 KB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'product-images';

-- ── M6: next_order_number race condition ──────────────────────────────────
-- Take a transaction-scoped advisory lock keyed on owner_id so two concurrent
-- order inserts cannot both compute the same number. Lock auto-releases on
-- commit/rollback. Hash includes a salt so a different code path using the
-- same uuid won't accidentally share the lock.
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_date text := to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYYMMDD');
  v_count int;
  v_number text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- Salt 'order_number_v1' keeps this advisory namespace distinct from any
  -- other lock that hashes on owner uuid.
  PERFORM pg_advisory_xact_lock(hashtextextended('order_number_v1:' || v_owner::text, 0));

  SELECT count(*) + 1 INTO v_count
  FROM public.orders
  WHERE owner_id = v_owner
    AND order_number LIKE 'INT-' || v_date || '-%';

  v_number := 'INT-' || v_date || '-' || lpad(v_count::text, 3, '0');
  RETURN v_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_order_number() TO authenticated;
