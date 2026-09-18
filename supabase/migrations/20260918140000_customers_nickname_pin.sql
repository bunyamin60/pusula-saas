-- Guest auth: nickname + 4-digit PIN on customers.

alter table public.customers
  add column if not exists nickname text;

alter table public.customers
  add column if not exists pin_code text;

-- One nickname per cafe (case-insensitive). Empty nicknames stay out of the index.
create unique index if not exists idx_customers_tenant_nickname
  on public.customers (tenant_id, lower(trim(nickname)))
  where nickname is not null and length(trim(nickname)) > 0;
