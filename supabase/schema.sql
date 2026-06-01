create extension if not exists pgcrypto;
create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_prices (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loading_records (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_records (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.returns_records (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses_records (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_payload_gin on public.users using gin (payload);
create index if not exists products_payload_gin on public.products using gin (payload);
create index if not exists product_prices_payload_gin on public.product_prices using gin (payload);
create index if not exists inventory_movements_payload_gin on public.inventory_movements using gin (payload);
create index if not exists loading_records_payload_gin on public.loading_records using gin (payload);
create index if not exists sales_records_payload_gin on public.sales_records using gin (payload);
create index if not exists cash_records_payload_gin on public.cash_records using gin (payload);
create index if not exists returns_records_payload_gin on public.returns_records using gin (payload);
create index if not exists expenses_records_payload_gin on public.expenses_records using gin (payload);
create index if not exists audit_logs_payload_gin on public.audit_logs using gin (payload);

alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.loading_records enable row level security;
alter table public.sales_records enable row level security;
alter table public.cash_records enable row level security;
alter table public.returns_records enable row level security;
alter table public.expenses_records enable row level security;
alter table public.audit_logs enable row level security;

create policy "KingApp demo read users" on public.users for select using (true);
create policy "KingApp demo write users" on public.users for insert with check (true);
create policy "KingApp demo update users" on public.users for update using (true) with check (true);

create policy "KingApp demo read products" on public.products for select using (true);
create policy "KingApp demo write products" on public.products for insert with check (true);
create policy "KingApp demo update products" on public.products for update using (true) with check (true);

create policy "KingApp demo read product prices" on public.product_prices for select using (true);
create policy "KingApp demo write product prices" on public.product_prices for insert with check (true);
create policy "KingApp demo update product prices" on public.product_prices for update using (true) with check (true);

create policy "KingApp demo read inventory movements" on public.inventory_movements for select using (true);
create policy "KingApp demo write inventory movements" on public.inventory_movements for insert with check (true);
create policy "KingApp demo update inventory movements" on public.inventory_movements for update using (true) with check (true);

create policy "KingApp demo read loading records" on public.loading_records for select using (true);
create policy "KingApp demo write loading records" on public.loading_records for insert with check (true);
create policy "KingApp demo update loading records" on public.loading_records for update using (true) with check (true);

create policy "KingApp demo read sales records" on public.sales_records for select using (true);
create policy "KingApp demo write sales records" on public.sales_records for insert with check (true);
create policy "KingApp demo update sales records" on public.sales_records for update using (true) with check (true);

create policy "KingApp demo read cash records" on public.cash_records for select using (true);
create policy "KingApp demo write cash records" on public.cash_records for insert with check (true);
create policy "KingApp demo update cash records" on public.cash_records for update using (true) with check (true);

create policy "KingApp demo read returns records" on public.returns_records for select using (true);
create policy "KingApp demo write returns records" on public.returns_records for insert with check (true);
create policy "KingApp demo update returns records" on public.returns_records for update using (true) with check (true);

create policy "KingApp demo read expenses records" on public.expenses_records for select using (true);
create policy "KingApp demo write expenses records" on public.expenses_records for insert with check (true);
create policy "KingApp demo update expenses records" on public.expenses_records for update using (true) with check (true);

create policy "KingApp demo read audit logs" on public.audit_logs for select using (true);
create policy "KingApp demo write audit logs" on public.audit_logs for insert with check (true);
create policy "KingApp demo update audit logs" on public.audit_logs for update using (true) with check (true);

insert into public.users (id, payload)
values
  ('admin', '{"username":"admin","password":"admin123","displayName":"System Admin","role":"admin","phone":"","email":"","status":"active","createdAt":"2026-05-30T00:00:00.000Z","updatedAt":"2026-05-30T00:00:00.000Z"}'),
  ('supervisor', '{"username":"supervisor","password":"supervisor123","displayName":"Supervisor","role":"supervisor","phone":"","email":"","status":"active","createdAt":"2026-05-30T00:00:00.000Z","updatedAt":"2026-05-30T00:00:00.000Z"}'),
  ('storekeeper', '{"username":"storekeeper","password":"store123","displayName":"Storekeeper","role":"storekeeper","phone":"","email":"","status":"active","createdAt":"2026-05-30T00:00:00.000Z","updatedAt":"2026-05-30T00:00:00.000Z"}'),
  ('accountant', '{"username":"accountant","password":"cashier123","displayName":"Accountant","role":"accountant","phone":"","email":"","status":"active","createdAt":"2026-05-30T00:00:00.000Z","updatedAt":"2026-05-30T00:00:00.000Z"}'),
  ('manager', '{"username":"manager","password":"manager123","displayName":"Manager","role":"manager","phone":"","email":"","status":"active","createdAt":"2026-05-30T00:00:00.000Z","updatedAt":"2026-05-30T00:00:00.000Z"}'),
  ('marketer1', '{"username":"marketer1","password":"marketer123","displayName":"Marketer 1","role":"marketer","phone":"","email":"","status":"active","createdAt":"2026-05-30T00:00:00.000Z","updatedAt":"2026-05-30T00:00:00.000Z"}')
on conflict (id) do update
set payload = excluded.payload,
    updated_at = now();

insert into public.products (id, payload)
values
  ('WT-500', '{"name":"Water 500ml","itemCode":"WT-500","unit":"Cartons","category":"Bottled Water","minimumStock":100,"openingStock":500,"pricePerCarton":1999}'),
  ('WT-1000', '{"name":"Water 1L","itemCode":"WT-1000","unit":"Cartons","category":"Bottled Water","minimumStock":80,"openingStock":300,"pricePerCarton":2500}'),
  ('WT-1500', '{"name":"Water 1.5L","itemCode":"WT-1500","unit":"Cartons","category":"Bottled Water","minimumStock":60,"openingStock":200,"pricePerCarton":3000}')
on conflict (id) do update
set payload = excluded.payload,
    updated_at = now();

insert into public.inventory_movements (id, payload)
values
  ('DEFAULT-OPENING-WT-500', '{"id":"DEFAULT-OPENING-WT-500","date":"2026-05-30","productName":"Water 500ml","itemCode":"WT-500","movementType":"Opening Stock","quantity":500,"reference":"Default Product Master","user":"System","notes":"Cartons - Bottled Water"}'),
  ('DEFAULT-OPENING-WT-1000', '{"id":"DEFAULT-OPENING-WT-1000","date":"2026-05-30","productName":"Water 1L","itemCode":"WT-1000","movementType":"Opening Stock","quantity":300,"reference":"Default Product Master","user":"System","notes":"Cartons - Bottled Water"}'),
  ('DEFAULT-OPENING-WT-1500', '{"id":"DEFAULT-OPENING-WT-1500","date":"2026-05-30","productName":"Water 1.5L","itemCode":"WT-1500","movementType":"Opening Stock","quantity":200,"reference":"Default Product Master","user":"System","notes":"Cartons - Bottled Water"}')
on conflict (id) do update
set payload = excluded.payload,
    updated_at = now();

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text unique not null,
  phone text,
  location text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  owner_name text,
  username text unique not null,
  phone text,
  location text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_clients (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_marketer text,
  active boolean not null default true,
  custom_prices jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (supplier_id, client_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  status text not null default 'Pending',
  payment_status text not null default 'Unpaid',
  assigned_marketer text,
  delivery_date date,
  delivery_truck text,
  delivery_driver text,
  delivery_person text,
  estimated_arrival_time time,
  estimated_arrival_end_time time,
  driver_minutes_away integer,
  notifications jsonb not null default '[]'::jsonb,
  total_quantity numeric not null default 0,
  total_amount numeric not null default 0,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  item_code text not null,
  quantity numeric not null default 0,
  price_per_carton numeric not null default 0,
  amount numeric not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  amount numeric not null default 0,
  status text not null default 'Pending',
  received_by text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists supplier_clients_supplier_idx on public.supplier_clients (supplier_id);
create index if not exists supplier_clients_client_idx on public.supplier_clients (client_id);
create index if not exists orders_supplier_idx on public.orders (supplier_id);
create index if not exists orders_client_idx on public.orders (client_id);
create index if not exists payments_supplier_client_idx on public.payments (supplier_id, client_id);

alter table public.suppliers enable row level security;
alter table public.clients enable row level security;
alter table public.supplier_clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy "Admin can manage suppliers" on public.suppliers for all using (true) with check (true);
create policy "Admin can manage clients" on public.clients for all using (true) with check (true);
create policy "Admin can manage supplier links" on public.supplier_clients for all using (true) with check (true);
create policy "Admin can manage portal orders" on public.orders for all using (true) with check (true);
create policy "Admin can manage portal order items" on public.order_items for all using (true) with check (true);
create policy "Admin can manage portal payments" on public.payments for all using (true) with check (true);

-- Live RLS note:
-- Replace the permissive admin/demo policies above with auth.jwt() role checks.
-- Client policies should filter by orders.client_id and supplier_clients.client_id.
-- Supplier policies should filter by orders.supplier_id and supplier_clients.supplier_id.
-- This prevents URL changes from exposing another supplier or client's data.
