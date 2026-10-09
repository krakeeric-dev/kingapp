-- Row Level Security as it is TODAY: on for every table, but every policy allows everyone (true)
-- Reconstructed from supabase/schema.sql by the Phase 1 audit. NOT an export of the live database.
-- Safe for a new, empty test project. Do not run against the live project.

-- WARNING: these policies let anyone holding the public anon key read, insert and update every row.
-- They reproduce the current behaviour so the test copy works like the live app. Phase 2 replaces them.
-- No delete policy exists, so deletes through the API are already blocked.

alter table public.users enable row level security;
alter table public.companies enable row level security;
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

create policy "KingApp demo read companies" on public.companies for select using (true);
create policy "KingApp demo write companies" on public.companies for insert with check (true);
create policy "KingApp demo update companies" on public.companies for update using (true) with check (true);

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

alter table public.call_center_agents enable row level security;
alter table public.call_center_extensions enable row level security;
alter table public.call_logs enable row level security;
alter table public.call_events enable row level security;
alter table public.call_recordings enable row level security;
alter table public.call_queue enable row level security;
alter table public.callbacks enable row level security;
alter table public.complaints enable row level security;
alter table public.payment_followups enable row level security;
alter table public.client_notes enable row level security;

alter table public.delivery_records enable row level security;
alter table public.delivery_drivers enable row level security;
alter table public.delivery_vehicles enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.customer_debts enable row level security;
alter table public.customer_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['delivery_records','delivery_drivers','delivery_vehicles','customer_accounts','customer_debts','customer_payments']
  loop
    execute format('create policy %L on public.%I for select using (true)', 'KingApp demo read ' || t, t);
    execute format('create policy %L on public.%I for insert with check (true)', 'KingApp demo write ' || t, t);
    execute format('create policy %L on public.%I for update using (true) with check (true)', 'KingApp demo update ' || t, t);
  end loop;
end $$;
