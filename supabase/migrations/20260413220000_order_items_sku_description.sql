-- Add product SKU and description snapshot to order_items
ALTER TABLE order_items ADD COLUMN product_sku text;
ALTER TABLE order_items ADD COLUMN product_description text;
