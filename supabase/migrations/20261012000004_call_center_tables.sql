-- Call center tables (not used by the app code yet; the call center runs on browser storage)
-- Reconstructed from supabase/schema.sql by the Phase 1 audit. NOT an export of the live database.
-- Safe for a new, empty test project. Do not run against the live project.

create table if not exists public.call_center_agents (
  id text primary key,
  name text not null,
  extension text not null,
  status text not null,
  phone_type text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_center_extensions (
  id text primary key,
  agent_id text,
  extension text not null,
  device_type text not null,
  device_name text,
  sip_username text,
  status text not null default 'Offline',
  last_seen timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_logs (
  id text primary key,
  client_id text,
  phone_number text not null,
  agent_id text,
  order_id text,
  complaint_id text,
  payment_followup_id text,
  call_type text,
  duration text,
  outcome text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_events (
  id text primary key,
  call_id text,
  event_type text not null,
  provider text,
  signature_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.call_recordings (
  id text primary key,
  call_id text not null,
  client_id text,
  agent_id text,
  recording_url text,
  duration text,
  status text not null default 'Not Connected',
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.call_queue (
  id text primary key,
  client_id text,
  phone_number text not null,
  agent_id text,
  status text not null,
  priority text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.callbacks (
  id text primary key,
  client_id text,
  phone text,
  assigned_agent text,
  priority text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id text primary key,
  client_id text,
  status text,
  priority text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_followups (
  id text primary key,
  client_id text,
  amount_due numeric not null default 0,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_notes (
  id text primary key,
  client_id text,
  note text not null,
  created_by text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.call_center_agents add column if not exists company_id text;
alter table public.call_center_extensions add column if not exists company_id text;
alter table public.call_logs add column if not exists company_id text;
alter table public.call_events add column if not exists company_id text;
alter table public.call_recordings add column if not exists company_id text;
alter table public.call_queue add column if not exists company_id text;
alter table public.callbacks add column if not exists company_id text;
alter table public.complaints add column if not exists company_id text;
alter table public.payment_followups add column if not exists company_id text;
alter table public.client_notes add column if not exists company_id text;
create index if not exists call_logs_company_id_idx on public.call_logs (company_id);
create index if not exists call_queue_company_id_idx on public.call_queue (company_id);
create index if not exists complaints_company_id_idx on public.complaints (company_id);
create index if not exists callbacks_company_id_idx on public.callbacks (company_id);
