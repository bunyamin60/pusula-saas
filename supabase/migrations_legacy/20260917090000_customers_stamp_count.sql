create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  client_id text not null,
  stamp_count integer not null default 0,
  last_coupon_code text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_id)
);

alter table public.customers
  add column if not exists stamp_count integer not null default 0;

alter table public.customers
  add column if not exists last_coupon_code text;

alter table public.customers
  add column if not exists client_id text;

create unique index if not exists customers_tenant_client_idx
  on public.customers (tenant_id, client_id);

alter table public.customers enable row level security;

grant select, insert, update on public.customers to anon, authenticated;

drop policy if exists "customers_select" on public.customers;
drop policy if exists "customers_insert" on public.customers;
drop policy if exists "customers_update" on public.customers;

create policy "customers_select"
  on public.customers
  for select
  to anon, authenticated
  using (true);

create policy "customers_insert"
  on public.customers
  for insert
  to anon, authenticated
  with check (true);

create policy "customers_update"
  on public.customers
  for update
  to anon, authenticated
  using (true)
  with check (true);
