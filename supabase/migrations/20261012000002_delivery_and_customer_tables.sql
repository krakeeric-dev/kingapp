-- Delivery and customer-account tables
-- Reconstructed from supabase/schema.sql by the Phase 1 audit. NOT an export of the live database.
-- Safe for a new, empty test project. Do not run against the live project.

-- These six tables are written by the app (lib/delivery-data.ts, lib/customer-accounts-data.ts)
-- through lib/supabase.ts but are NOT in schema.sql. They use the same shape as the other payload tables.
-- Check the live project: if they are missing there, those writes are failing and queuing offline.

do $$
declare t text;
begin
  foreach t in array array['delivery_records','delivery_drivers','delivery_vehicles','customer_accounts','customer_debts','customer_payments']
  loop
    execute format('create table if not exists public.%I (id text primary key, company_id text, payload jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())', t);
    execute format('create index if not exists %I on public.%I (company_id)', t || '_company_id_idx', t);
    execute format('create index if not exists %I on public.%I using gin (payload)', t || '_payload_gin', t);
  end loop;
end $$;
