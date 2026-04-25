-- ============================================================================
-- Stock (envanter) + idempotency_key (offline queue duplicate guard)
-- ============================================================================
-- 1. products.stock : int, default 0, owner-entered. Auto-decremented when
--    an order_items row is inserted via trigger below.
-- 2. orders.idempotency_key : uuid, nullable, unique per owner. orderQueue
--    client attaches the same key to each retry so a network-partition
--    replay cannot create a duplicate order (which would then cause the
--    stock trigger to decrement twice).
-- 3. trigger decrement_product_stock : runs AFTER INSERT on order_items,
--    atomic within the same implicit transaction as the row insert.
--    If items insert rolls back (existing manual rollback path in
--    createOrder), stock change rolls back too.
-- ============================================================================

-- 1. Stock column -------------------------------------------------------------
alter table public.products
  add column if not exists stock int not null default 0
  check (stock >= -9999);

-- Perf: low-stock count query (sidebar badge) scans owner + threshold.
create index if not exists products_owner_stock_idx
  on public.products(owner_id, stock);

-- 2. Idempotency key on orders ------------------------------------------------
alter table public.orders
  add column if not exists idempotency_key uuid;

-- Partial unique index: only enforces uniqueness when key is present.
-- Pre-existing rows without a key are unaffected.
create unique index if not exists orders_owner_idempotency_idx
  on public.orders(owner_id, idempotency_key)
  where idempotency_key is not null;

-- 3. Stock decrement trigger --------------------------------------------------
create or replace function public.decrement_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- product_id can be null (product deleted after order snapshot). Skip those.
  if new.product_id is not null then
    update public.products
    set stock = stock - new.quantity,
        updated_at = now()
    where id = new.product_id
      and owner_id = new.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_decrement_stock on public.order_items;

create trigger order_items_decrement_stock
  after insert on public.order_items
  for each row
  execute function public.decrement_product_stock();
