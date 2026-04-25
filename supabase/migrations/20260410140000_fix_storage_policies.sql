-- ============================================================================
-- Fix storage policies: restrict update/delete to own uploads
-- ============================================================================
-- CRITICAL: Previous policies allowed any authenticated user to update/delete
-- any file in product-images bucket. Now restricted to file owner only.
-- ============================================================================

-- Drop existing overly-permissive policies
drop policy if exists "auth_upload_product_images" on storage.objects;
drop policy if exists "auth_update_product_images" on storage.objects;
drop policy if exists "auth_delete_product_images" on storage.objects;

-- Re-create with owner checks
-- Upload: authenticated users can upload to their own folder (uid prefix)
create policy "auth_upload_product_images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Update: only the file owner can update
create policy "auth_update_product_images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and owner = auth.uid()
);

-- Delete: only the file owner can delete
create policy "auth_delete_product_images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and owner = auth.uid()
);
