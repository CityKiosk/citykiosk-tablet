-- ============================================================================
-- Remove the "name is always visible" server-side lock
-- ============================================================================
-- Earlier migrations raised an exception when anyone tried to set
-- display_fields.name = false. The shop owner wants full control — if they
-- want a name-less vitrin (image-only magazine look, for example), that's

-- their call. Removing the guard here and in the server action; client UI
-- is updated to actually respect fields.name in the product cards.
-- ============================================================================

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
