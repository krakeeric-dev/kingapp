-- KingApp factory tables: raw materials, production records, water and electricity.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- Until this has been run, these records stay on the device they were entered on.
-- After it has been run, each device uploads what it holds the next time it opens the app.
--
-- Access rules match the existing KingApp tables (open to the app's public key),
-- so they share the same weakness and must be tightened together when sign-in
-- moves to Supabase Auth.

create table if not exists public.raw_material_master (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raw_material_master_company_id_idx on public.raw_material_master (company_id);

alter table public.raw_material_master enable row level security;

drop policy if exists "KingApp demo read raw material master" on public.raw_material_master;
drop policy if exists "KingApp demo write raw material master" on public.raw_material_master;
drop policy if exists "KingApp demo update raw material master" on public.raw_material_master;
create policy "KingApp demo read raw material master" on public.raw_material_master for select using (true);
create policy "KingApp demo write raw material master" on public.raw_material_master for insert with check (true);
create policy "KingApp demo update raw material master" on public.raw_material_master for update using (true) with check (true);

create table if not exists public.raw_material_movements (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raw_material_movements_company_id_idx on public.raw_material_movements (company_id);

alter table public.raw_material_movements enable row level security;

drop policy if exists "KingApp demo read raw material movements" on public.raw_material_movements;
drop policy if exists "KingApp demo write raw material movements" on public.raw_material_movements;
drop policy if exists "KingApp demo update raw material movements" on public.raw_material_movements;
create policy "KingApp demo read raw material movements" on public.raw_material_movements for select using (true);
create policy "KingApp demo write raw material movements" on public.raw_material_movements for insert with check (true);
create policy "KingApp demo update raw material movements" on public.raw_material_movements for update using (true) with check (true);

create table if not exists public.raw_material_minimums (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raw_material_minimums_company_id_idx on public.raw_material_minimums (company_id);

alter table public.raw_material_minimums enable row level security;

drop policy if exists "KingApp demo read raw material minimums" on public.raw_material_minimums;
drop policy if exists "KingApp demo write raw material minimums" on public.raw_material_minimums;
drop policy if exists "KingApp demo update raw material minimums" on public.raw_material_minimums;
create policy "KingApp demo read raw material minimums" on public.raw_material_minimums for select using (true);
create policy "KingApp demo write raw material minimums" on public.raw_material_minimums for insert with check (true);
create policy "KingApp demo update raw material minimums" on public.raw_material_minimums for update using (true) with check (true);

create table if not exists public.production_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_records_company_id_idx on public.production_records (company_id);

alter table public.production_records enable row level security;

drop policy if exists "KingApp demo read production records" on public.production_records;
drop policy if exists "KingApp demo write production records" on public.production_records;
drop policy if exists "KingApp demo update production records" on public.production_records;
create policy "KingApp demo read production records" on public.production_records for select using (true);
create policy "KingApp demo write production records" on public.production_records for insert with check (true);
create policy "KingApp demo update production records" on public.production_records for update using (true) with check (true);

create table if not exists public.utility_records (
  id text primary key,
  company_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists utility_records_company_id_idx on public.utility_records (company_id);

alter table public.utility_records enable row level security;

drop policy if exists "KingApp demo read utility records" on public.utility_records;
drop policy if exists "KingApp demo write utility records" on public.utility_records;
drop policy if exists "KingApp demo update utility records" on public.utility_records;
create policy "KingApp demo read utility records" on public.utility_records for select using (true);
create policy "KingApp demo write utility records" on public.utility_records for insert with check (true);
create policy "KingApp demo update utility records" on public.utility_records for update using (true) with check (true);
