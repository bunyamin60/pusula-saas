-- Dual economy: XP (soft) + stamps (hard) with server-side anti-cheat.

-- ─── Tenant venue mode (masa | kasa) ─────────────────────────────────────────
alter table public.tenant_settings
  add column if not exists venue_mode text not null default 'masa';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenant_settings_venue_mode_check'
  ) then
    alter table public.tenant_settings
      add constraint tenant_settings_venue_mode_check
      check (venue_mode in ('masa', 'kasa'));
  end if;
end $$;

-- ─── Customer economy columns ────────────────────────────────────────────────
alter table public.customers
  add column if not exists xp_total integer not null default 0;

alter table public.customers
  add column if not exists xp_day date;

alter table public.customers
  add column if not exists xp_day_earned integer not null default 0;

alter table public.customers
  add column if not exists stamp_last_approved_at timestamptz;

-- ─── Protect economy fields from client upserts ──────────────────────────────
create or replace function public.protect_customer_economy()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('app.economy_write', true), '') is distinct from '1' then
    new.stamp_count := old.stamp_count;
    new.xp_total := old.xp_total;
    new.xp_day := old.xp_day;
    new.xp_day_earned := old.xp_day_earned;
    new.stamp_last_approved_at := old.stamp_last_approved_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_customer_economy on public.customers;
create trigger trg_protect_customer_economy
  before update on public.customers
  for each row
  execute function public.protect_customer_economy();

-- ─── XP configs ──────────────────────────────────────────────────────────────
create table if not exists public.xp_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  activity_name text not null,
  label text not null default '',
  base_xp integer not null default 0,
  multiplier double precision not null default 0,
  max_xp_per_action integer not null default 100,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, activity_name)
);

create index if not exists xp_configs_tenant_idx on public.xp_configs (tenant_id);

alter table public.xp_configs enable row level security;

grant select on public.xp_configs to anon, authenticated;
grant insert, update on public.xp_configs to anon, authenticated;

drop policy if exists "xp_configs_select" on public.xp_configs;
drop policy if exists "xp_configs_insert" on public.xp_configs;
drop policy if exists "xp_configs_update" on public.xp_configs;

create policy "xp_configs_select"
  on public.xp_configs for select to anon, authenticated using (true);

create policy "xp_configs_insert"
  on public.xp_configs for insert to anon, authenticated with check (true);

create policy "xp_configs_update"
  on public.xp_configs for update to anon, authenticated using (true) with check (true);

-- Seed default configs for known tenants (idempotent)
insert into public.xp_configs (tenant_id, activity_name, label, base_xp, multiplier, max_xp_per_action)
select t.id, v.activity_name, v.label, v.base_xp, v.multiplier, v.max_xp_per_action
from public.tenant_settings t
cross join (
  values
    ('gunun_sorusu', 'Günün Sorusu', 10, 0::float8, 10),
    ('quiz', 'Bilgi Yarışması', 0, 0.15::float8, 40),
    ('blockblast', 'Block Blast', 0, 0.02::float8, 40),
    ('taboo', 'Tabu', 15, 0::float8, 15),
    ('whoami', 'Ben Kimim', 15, 0::float8, 15),
    ('draw', 'Çiz & Bil', 20, 0::float8, 20),
    ('mini_oyun', 'Mini Oyun', 10, 0::float8, 10)
) as v(activity_name, label, base_xp, multiplier, max_xp_per_action)
on conflict (tenant_id, activity_name) do nothing;

-- Also seed for default slug even if settings row missing later via API

-- ─── Stamp requests ──────────────────────────────────────────────────────────
create table if not exists public.stamp_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  client_id text not null,
  table_label text,
  code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stamp_requests_tenant_pending_idx
  on public.stamp_requests (tenant_id, status, created_at desc);

create index if not exists stamp_requests_client_idx
  on public.stamp_requests (tenant_id, client_id, created_at desc);

alter table public.stamp_requests enable row level security;

grant select, insert, update on public.stamp_requests to anon, authenticated;

drop policy if exists "stamp_requests_select" on public.stamp_requests;
drop policy if exists "stamp_requests_insert" on public.stamp_requests;
drop policy if exists "stamp_requests_update" on public.stamp_requests;

create policy "stamp_requests_select"
  on public.stamp_requests for select to anon, authenticated using (true);

create policy "stamp_requests_insert"
  on public.stamp_requests for insert to anon, authenticated with check (true);

create policy "stamp_requests_update"
  on public.stamp_requests for update to anon, authenticated using (true) with check (true);

-- Protect stamp request status/code from client tampering
create or replace function public.protect_stamp_request()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('app.economy_write', true), '') is distinct from '1' then
    new.status := old.status;
    new.code := old.code;
    new.expires_at := old.expires_at;
    new.approved_at := old.approved_at;
    new.client_id := old.client_id;
    new.tenant_id := old.tenant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_stamp_request on public.stamp_requests;
create trigger trg_protect_stamp_request
  before update on public.stamp_requests
  for each row
  execute function public.protect_stamp_request();

-- ─── Stamp redeem proofs (anti-screenshot gift screen) ───────────────────────
create table if not exists public.stamp_redeem_proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  client_id text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists stamp_redeem_proofs_client_idx
  on public.stamp_redeem_proofs (tenant_id, client_id, created_at desc);

alter table public.stamp_redeem_proofs enable row level security;

grant select, insert on public.stamp_redeem_proofs to anon, authenticated;

drop policy if exists "stamp_redeem_proofs_select" on public.stamp_redeem_proofs;
drop policy if exists "stamp_redeem_proofs_insert" on public.stamp_redeem_proofs;

create policy "stamp_redeem_proofs_select"
  on public.stamp_redeem_proofs for select to anon, authenticated using (true);

create policy "stamp_redeem_proofs_insert"
  on public.stamp_redeem_proofs for insert to anon, authenticated with check (true);

-- ─── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.economy_today()
returns date
language sql
stable
as $$
  select (timezone('Europe/Istanbul', now()))::date;
$$;

create or replace function public.ensure_customer_row(
  p_tenant_id text,
  p_client_id text
)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.customers;
begin
  insert into public.customers (tenant_id, client_id)
  values (p_tenant_id, p_client_id)
  on conflict (tenant_id, client_id) do update
    set updated_at = now()
  returning * into row;

  select * into row
  from public.customers
  where tenant_id = p_tenant_id and client_id = p_client_id;

  return row;
end;
$$;

grant execute on function public.ensure_customer_row(text, text) to anon, authenticated;

-- ─── award_xp: client sends activity_name + optional score ONLY ───────────────
create or replace function public.award_xp(
  p_tenant_id text,
  p_client_id text,
  p_activity_name text,
  p_score integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.xp_configs;
  cust public.customers;
  today date := public.economy_today();
  day_earned integer;
  computed integer;
  granted integer;
  remaining integer;
  daily_cap integer := 100;
begin
  if p_tenant_id is null or length(trim(p_tenant_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_client_id is null or length(trim(p_client_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into cfg
  from public.xp_configs
  where tenant_id = p_tenant_id
    and activity_name = trim(p_activity_name)
    and enabled = true
  limit 1;

  if cfg.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_activity');
  end if;

  if cfg.multiplier > 0 and p_score is not null and p_score > 0 then
    computed := floor(p_score::float8 * cfg.multiplier)::integer;
  else
    computed := greatest(0, cfg.base_xp);
  end if;

  computed := greatest(0, least(computed, cfg.max_xp_per_action));
  if computed <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'zero_xp', 'granted', 0);
  end if;

  cust := public.ensure_customer_row(p_tenant_id, p_client_id);

  if cust.xp_day is distinct from today then
    day_earned := 0;
  else
    day_earned := coalesce(cust.xp_day_earned, 0);
  end if;

  remaining := greatest(0, daily_cap - day_earned);
  if remaining <= 0 then
    return jsonb_build_object(
      'ok', true,
      'capped', true,
      'granted', 0,
      'xp_total', cust.xp_total,
      'xp_day_earned', day_earned,
      'daily_cap', daily_cap,
      'reason', 'daily_cap'
    );
  end if;

  granted := least(computed, remaining);

  perform set_config('app.economy_write', '1', true);

  update public.customers
  set
    xp_total = coalesce(xp_total, 0) + granted,
    xp_day = today,
    xp_day_earned = day_earned + granted,
    updated_at = now()
  where tenant_id = p_tenant_id and client_id = p_client_id
  returning * into cust;

  return jsonb_build_object(
    'ok', true,
    'capped', (day_earned + granted) >= daily_cap,
    'granted', granted,
    'computed', computed,
    'xp_total', cust.xp_total,
    'xp_day_earned', cust.xp_day_earned,
    'daily_cap', daily_cap
  );
end;
$$;

grant execute on function public.award_xp(text, text, text, integer) to anon, authenticated;

-- ─── create_stamp_request ────────────────────────────────────────────────────
create or replace function public.create_stamp_request(
  p_tenant_id text,
  p_client_id text,
  p_table_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cust public.customers;
  mode text;
  cooldown interval := interval '12 hours';
  code text;
  req public.stamp_requests;
begin
  cust := public.ensure_customer_row(p_tenant_id, p_client_id);

  if cust.stamp_last_approved_at is not null
     and cust.stamp_last_approved_at > now() - cooldown then
    return jsonb_build_object(
      'ok', false,
      'reason', 'cooldown',
      'retry_at', cust.stamp_last_approved_at + cooldown
    );
  end if;

  -- Expire old pending for this client
  perform set_config('app.economy_write', '1', true);
  update public.stamp_requests
  set status = 'expired'
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status = 'pending';

  select coalesce(venue_mode, 'masa') into mode
  from public.tenant_settings
  where id = p_tenant_id;

  if mode is null then
    mode := 'masa';
  end if;

  if mode = 'masa' and (p_table_label is null or length(trim(p_table_label)) = 0) then
    return jsonb_build_object('ok', false, 'reason', 'table_required', 'venue_mode', mode);
  end if;

  code := lpad((100 + floor(random() * 900))::int::text, 3, '0');

  insert into public.stamp_requests (
    tenant_id, client_id, table_label, code, status, expires_at
  ) values (
    p_tenant_id,
    p_client_id,
    case when mode = 'masa' then trim(p_table_label) else null end,
    code,
    'pending',
    now() + interval '3 minutes'
  )
  returning * into req;

  return jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', req.id,
      'code', req.code,
      'table_label', req.table_label,
      'expires_at', req.expires_at,
      'status', req.status,
      'venue_mode', mode
    )
  );
end;
$$;

grant execute on function public.create_stamp_request(text, text, text) to anon, authenticated;

-- ─── approve_stamp_request ───────────────────────────────────────────────────
create or replace function public.approve_stamp_request(
  p_tenant_id text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.stamp_requests;
  cust public.customers;
  stamp_goal integer := 6;
begin
  select * into req
  from public.stamp_requests
  where id = p_request_id and tenant_id = p_tenant_id
  for update;

  if req.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending', 'status', req.status);
  end if;

  if req.expires_at < now() then
    perform set_config('app.economy_write', '1', true);
    update public.stamp_requests
    set status = 'expired'
    where id = req.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  cust := public.ensure_customer_row(p_tenant_id, req.client_id);

  perform set_config('app.economy_write', '1', true);

  update public.stamp_requests
  set status = 'approved', approved_at = now()
  where id = req.id;

  update public.customers
  set
    stamp_count = least(stamp_goal, coalesce(stamp_count, 0) + 1),
    stamp_last_approved_at = now(),
    updated_at = now()
  where tenant_id = p_tenant_id and client_id = req.client_id
  returning * into cust;

  return jsonb_build_object(
    'ok', true,
    'stamp_count', cust.stamp_count,
    'stamp_goal', stamp_goal,
    'client_id', req.client_id,
    'code', req.code
  );
end;
$$;

grant execute on function public.approve_stamp_request(text, uuid) to anon, authenticated;

-- ─── redeem_stamp_reward ─────────────────────────────────────────────────────
create or replace function public.redeem_stamp_reward(
  p_tenant_id text,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cust public.customers;
  stamp_goal integer := 6;
  proof public.stamp_redeem_proofs;
  proof_code text;
begin
  cust := public.ensure_customer_row(p_tenant_id, p_client_id);

  if coalesce(cust.stamp_count, 0) < stamp_goal then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_enough',
      'stamp_count', coalesce(cust.stamp_count, 0),
      'stamp_goal', stamp_goal
    );
  end if;

  proof_code := lpad((100 + floor(random() * 900))::int::text, 3, '0');

  perform set_config('app.economy_write', '1', true);

  update public.customers
  set
    stamp_count = coalesce(stamp_count, 0) - stamp_goal,
    updated_at = now()
  where tenant_id = p_tenant_id and client_id = p_client_id
  returning * into cust;

  insert into public.stamp_redeem_proofs (
    tenant_id, client_id, code, expires_at
  ) values (
    p_tenant_id, p_client_id, proof_code, now() + interval '3 minutes'
  )
  returning * into proof;

  return jsonb_build_object(
    'ok', true,
    'stamp_count', cust.stamp_count,
    'proof', jsonb_build_object(
      'id', proof.id,
      'code', proof.code,
      'expires_at', proof.expires_at
    )
  );
end;
$$;

grant execute on function public.redeem_stamp_reward(text, text) to anon, authenticated;

-- ─── get_economy_status ──────────────────────────────────────────────────────
create or replace function public.get_economy_status(
  p_tenant_id text,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cust public.customers;
  today date := public.economy_today();
  day_earned integer;
  mode text;
  pending public.stamp_requests;
  cooldown_until timestamptz;
begin
  cust := public.ensure_customer_row(p_tenant_id, p_client_id);

  if cust.xp_day is distinct from today then
    day_earned := 0;
  else
    day_earned := coalesce(cust.xp_day_earned, 0);
  end if;

  select coalesce(venue_mode, 'masa') into mode
  from public.tenant_settings where id = p_tenant_id;
  if mode is null then mode := 'masa'; end if;

  if cust.stamp_last_approved_at is not null then
    cooldown_until := cust.stamp_last_approved_at + interval '12 hours';
  end if;

  select * into pending
  from public.stamp_requests
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'venue_mode', mode,
    'xp_total', coalesce(cust.xp_total, 0),
    'xp_day_earned', day_earned,
    'daily_cap', 100,
    'stamp_count', coalesce(cust.stamp_count, 0),
    'stamp_goal', 6,
    'stamp_cooldown_until', cooldown_until,
    'pending_request', case when pending.id is null then null else jsonb_build_object(
      'id', pending.id,
      'code', pending.code,
      'table_label', pending.table_label,
      'expires_at', pending.expires_at
    ) end
  );
end;
$$;

grant execute on function public.get_economy_status(text, text) to anon, authenticated;
