-- Supplier / client portal tables (not used by the app code yet; the portal runs on browser storage)
-- Reconstructed from supabase/schema.sql by the Phase 1 audit. NOT an export of the live database.
-- Safe for a new, empty test project. Do not run against the live project.

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

alter table public.suppliers add column if not exists company_id text;
alter table public.clients add column if not exists company_id text;
alter table public.supplier_clients add column if not exists company_id text;
alter table public.orders add column if not exists company_id text;
alter table public.order_items add column if not exists company_id text;
alter table public.payments add column if not exists company_id text;
create index if not exists suppliers_company_id_idx on public.suppliers (company_id);
create index if not exists clients_company_id_idx on public.clients (company_id);
create index if not exists orders_company_id_idx on public.orders (company_id);
