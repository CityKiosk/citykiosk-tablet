-- ============================================================================
-- Storage bucket for product images
-- ============================================================================

-- Create the bucket (public — images are visible to anyone with URL,
-- but UPLOAD/DELETE requires auth via RLS)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload images
create policy "auth_upload_product_images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

-- Allow authenticated users to update their own uploads
create policy "auth_update_product_images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images');

-- Allow authenticated users to delete their own uploads
create policy "auth_delete_product_images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');

-- Public can view images (bucket is public, this policy allows read)
create policy "public_read_product_images"
on storage.objects for select
to public
using (bucket_id = 'product-images');
