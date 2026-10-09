-- Payload tables (users, companies, products, records, audit_logs)
-- Reconstructed from supabase/schema.sql by the Phase 1 audit. NOT an export of the live database.
-- Safe for a new, empty test project. Do not run against the live project.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id text primary key,
  code text not null default '',
  name text not null,
  type text not null default 'Business',
  tin_number text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  logo text not null default '',
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_prices (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loading_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.returns_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_payload_gin on public.users using gin (payload);
create index if not exists companies_payload_gin on public.companies using gin (payload);
create index if not exists companies_status_idx on public.companies (status);
create index if not exists users_company_id_idx on public.users (company_id);
create index if not exists products_company_id_idx on public.products (company_id);
create index if not exists inventory_movements_company_id_idx on public.inventory_movements (company_id);
create index if not exists loading_records_company_id_idx on public.loading_records (company_id);
create index if not exists sales_records_company_id_idx on public.sales_records (company_id);
create index if not exists cash_records_company_id_idx on public.cash_records (company_id);
create index if not exists returns_records_company_id_idx on public.returns_records (company_id);
create index if not exists expenses_records_company_id_idx on public.expenses_records (company_id);
create index if not exists products_payload_gin on public.products using gin (payload);
create index if not exists product_prices_payload_gin on public.product_prices using gin (payload);
create index if not exists inventory_movements_payload_gin on public.inventory_movements using gin (payload);
create index if not exists loading_records_payload_gin on public.loading_records using gin (payload);
create index if not exists sales_records_payload_gin on public.sales_records using gin (payload);
create index if not exists cash_records_payload_gin on public.cash_records using gin (payload);
create index if not exists returns_records_payload_gin on public.returns_records using gin (payload);
create index if not exists expenses_records_payload_gin on public.expenses_records using gin (payload);
create index if not exists audit_logs_payload_gin on public.audit_logs using gin (payload);
