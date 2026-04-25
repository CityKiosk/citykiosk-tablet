-- ============================================================================
-- Souvenir Toptan — Initial Schema
-- ============================================================================
-- Single-user app: one shop owner manages their own catalog + customers + orders.
-- All tables use owner_id for RLS (trivially "auth.uid() = owner_id").
-- Bilingual support: category/product names have separate _tr and _de columns.
-- Order items snapshot product data at creation time for historical accuracy.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────────────────
create extension if not exists moddatetime schema extensions;


-- ──────────────────────────────────────────────────────────────────────────
-- profiles — 1-to-1 with auth.users
-- ──────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  shop_name text,        -- dükkan sahibinin kendi dükkan adı (PDF header'da kullanılır)
  shop_address text,     -- PDF header için adres
  shop_phone text,
  shop_email text,
  locale text not null default 'tr' check (locale in ('tr', 'de')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Profile trigger: auto-create profile when auth.user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create trigger handle_updated_at_profiles
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);

-- RLS policies
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- profiles silme yok — auth.users silinince cascade siler


-- ──────────────────────────────────────────────────────────────────────────
-- categories
-- ──────────────────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  slug text not null,                   -- URL için, owner scope'unda unique
  name_tr text not null,
  name_de text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

create index categories_owner_id_idx on public.categories(owner_id);
create index categories_owner_active_sort_idx on public.categories(owner_id, is_active, sort_order);

alter table public.categories enable row level security;

create trigger handle_updated_at_categories
  before update on public.categories
  for each row execute procedure extensions.moddatetime(updated_at);

create policy "categories_select_own"
  on public.categories for select
  using ((select auth.uid()) = owner_id);

create policy "categories_insert_own"
  on public.categories for insert
  with check ((select auth.uid()) = owner_id);

create policy "categories_update_own"
  on public.categories for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "categories_delete_own"
  on public.categories for delete
  using ((select auth.uid()) = owner_id);


-- ──────────────────────────────────────────────────────────────────────────
-- products
-- ──────────────────────────────────────────────────────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,

  -- Bilingual name (TR zorunlu, DE opsiyonel)
  name_tr text not null,
  name_de text,

  -- Bilingual description (ikisi de opsiyonel)
  description_tr text,
  description_de text,

  price numeric(10, 2) not null check (price >= 0),  -- EUR
  image_url text,                    -- Supabase Storage URL veya legacy static path
  sku text,                          -- opsiyonel stock keeping unit
  dimensions text,                   -- örn: "5x5 cm" — legacy 'dim' alanı
  packaging_unit int,                -- örn: 12 (kutuda 12 adet) — legacy 've' alanı
  sort_order int not null default 0,
  is_active boolean not null default true,  -- soft hide from catalog
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_owner_id_idx on public.products(owner_id);
create index products_category_id_idx on public.products(category_id);
create index products_owner_active_sort_idx on public.products(owner_id, is_active, sort_order);
create index products_name_tr_idx on public.products(owner_id, name_tr);
create index products_name_de_idx on public.products(owner_id, name_de);

alter table public.products enable row level security;

create trigger handle_updated_at_products
  before update on public.products
  for each row execute procedure extensions.moddatetime(updated_at);

create policy "products_select_own"
  on public.products for select
  using ((select auth.uid()) = owner_id);

create policy "products_insert_own"
  on public.products for insert
  with check ((select auth.uid()) = owner_id);

create policy "products_update_own"
  on public.products for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "products_delete_own"
  on public.products for delete
  using ((select auth.uid()) = owner_id);


-- ──────────────────────────────────────────────────────────────────────────
-- customers
-- ──────────────────────────────────────────────────────────────────────────
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  first_name text not null,          -- ad
  last_name text,                    -- soyad (opsiyonel)
  shop_name text not null,           -- müşterinin dükkan adı
  phone text,                        -- opsiyonel
  notes text,                        -- opsiyonel serbest not alanı
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_owner_id_idx on public.customers(owner_id);
create index customers_owner_active_name_idx on public.customers(owner_id, is_active, first_name);
create index customers_owner_shop_name_idx on public.customers(owner_id, shop_name);

alter table public.customers enable row level security;

create trigger handle_updated_at_customers
  before update on public.customers
  for each row execute procedure extensions.moddatetime(updated_at);

create policy "customers_select_own"
  on public.customers for select
  using ((select auth.uid()) = owner_id);

create policy "customers_insert_own"
  on public.customers for insert
  with check ((select auth.uid()) = owner_id);

create policy "customers_update_own"
  on public.customers for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "customers_delete_own"
  on public.customers for delete
  using ((select auth.uid()) = owner_id);


-- ──────────────────────────────────────────────────────────────────────────
-- orders
-- ──────────────────────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,

  -- Müşteri referansı + snapshot (müşteri silinse/değişse bile sipariş geçmişi korunur)
  customer_id uuid references public.customers(id) on delete set null,
  customer_first_name text not null,       -- snapshot
  customer_last_name text,                 -- snapshot
  customer_shop_name text not null,        -- snapshot
  customer_phone text,                     -- snapshot (varsa)

  order_number text not null,              -- internal sequential ID: INT-YYYYMMDD-NNN
  total numeric(10, 2) not null check (total >= 0),  -- EUR, items toplamı
  notes text,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'completed', 'cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(owner_id, order_number)
);

create index orders_owner_id_idx on public.orders(owner_id);
create index orders_customer_id_idx on public.orders(customer_id);
create index orders_owner_created_idx on public.orders(owner_id, created_at desc);
create index orders_owner_status_idx on public.orders(owner_id, status);

alter table public.orders enable row level security;

create trigger handle_updated_at_orders
  before update on public.orders
  for each row execute procedure extensions.moddatetime(updated_at);

create policy "orders_select_own"
  on public.orders for select
  using ((select auth.uid()) = owner_id);

create policy "orders_insert_own"
  on public.orders for insert
  with check ((select auth.uid()) = owner_id);

create policy "orders_update_own"
  on public.orders for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "orders_delete_own"
  on public.orders for delete
  using ((select auth.uid()) = owner_id);


-- ──────────────────────────────────────────────────────────────────────────
-- order_items
-- ──────────────────────────────────────────────────────────────────────────
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,

  -- Product referansı + snapshot (ürün silinse/değişse bile sipariş kalıcı)
  product_id uuid references public.products(id) on delete set null,
  product_name_tr text not null,           -- snapshot
  product_name_de text,                    -- snapshot
  product_image_url text,                  -- snapshot

  quantity int not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),   -- EUR, snapshot
  line_total numeric(10, 2) not null check (line_total >= 0),   -- quantity × unit_price
  sort_order int not null default 0,

  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_product_id_idx on public.order_items(product_id);
create index order_items_owner_id_idx on public.order_items(owner_id);

alter table public.order_items enable row level security;

create policy "order_items_select_own"
  on public.order_items for select
  using ((select auth.uid()) = owner_id);

create policy "order_items_insert_own"
  on public.order_items for insert
  with check ((select auth.uid()) = owner_id);

create policy "order_items_update_own"
  on public.order_items for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "order_items_delete_own"
  on public.order_items for delete
  using ((select auth.uid()) = owner_id);


-- ──────────────────────────────────────────────────────────────────────────
-- Helper function: next_order_number
-- INT-YYYYMMDD-NNN formatında sıradaki order numarasını döner (owner başına günlük sayaç)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_date text := to_char(now() at time zone 'Europe/Berlin', 'YYYYMMDD');
  v_count int;
  v_number text;
begin
  if v_owner is null then
    raise exception 'unauthenticated';
  end if;

  select count(*) + 1 into v_count
  from public.orders
  where owner_id = v_owner
    and order_number like 'INT-' || v_date || '-%';

  v_number := 'INT-' || v_date || '-' || lpad(v_count::text, 3, '0');
  return v_number;
end;
$$;

grant execute on function public.next_order_number() to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- Comments (dokümantasyon)
-- ──────────────────────────────────────────────────────────────────────────
comment on table public.profiles is 'User profile, 1-to-1 with auth.users. Shop owner details for PDF headers.';
comment on table public.categories is 'Product categories — bilingual (tr + optional de).';
comment on table public.products is 'Catalog products with bilingual names + optional description. Prices in EUR.';
comment on table public.customers is 'Customer shops (B2B wholesale customers). Owner = shop owner who serves them.';
comment on table public.orders is 'Orders with customer snapshot. order_number format: INT-YYYYMMDD-NNN.';
comment on table public.order_items is 'Order line items with product snapshot for historical integrity.';
comment on function public.next_order_number is 'Generates sequential internal order number: INT-YYYYMMDD-NNN (owner-scoped, Europe/Berlin timezone).';
