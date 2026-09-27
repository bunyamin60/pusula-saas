-- Weekly game-point leader earns one stamp when the Istanbul week closes.

alter table public.customers
  add column if not exists xp_week date;

alter table public.customers
  add column if not exists xp_week_earned integer not null default 0;

create table if not exists public.weekly_stamp_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  week_start date not null,
  client_id text not null,
  xp_earned integer not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, week_start)
);

alter table public.weekly_stamp_awards enable row level security;
revoke all on public.weekly_stamp_awards from anon, authenticated;

create or replace function public.economy_week_start()
returns date
language sql
stable
as $$
  select date_trunc('week', timezone('Europe/Istanbul', now()))::date;
$$;

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
    new.xp_week := old.xp_week;
    new.xp_week_earned := old.xp_week_earned;
    new.stamp_last_approved_at := old.stamp_last_approved_at;
  end if;
  return new;
end;
$$;

create or replace function public.protect_customer_economy_insert()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.economy_write', true), '') is distinct from '1' then
    new.stamp_count := 0;
    new.xp_total := 0;
    new.xp_day := null;
    new.xp_day_earned := 0;
    new.xp_week := null;
    new.xp_week_earned := 0;
    new.stamp_last_approved_at := null;
  end if;
  return new;
end;
$$;

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
  week_start date := public.economy_week_start();
  day_earned integer;
  week_earned integer;
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

  if cust.xp_week is distinct from week_start then
    week_earned := 0;
  else
    week_earned := coalesce(cust.xp_week_earned, 0);
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
    xp_week = week_start,
    xp_week_earned = week_earned + granted,
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

revoke all on function public.award_xp(text, text, text, integer) from public, anon, authenticated;

-- Closes the previous Istanbul week (Monday–Sunday) once.
create or replace function public.settle_weekly_leader_stamp(p_tenant_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_week date := public.economy_week_start() - 7;
  winner public.customers;
begin
  if p_tenant_id is null or length(trim(p_tenant_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if exists (
    select 1 from public.weekly_stamp_awards
    where tenant_id = p_tenant_id and week_start = previous_week
  ) then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already');
  end if;

  select * into winner
  from public.customers
  where tenant_id = p_tenant_id
    and xp_week = previous_week
    and coalesce(xp_week_earned, 0) > 0
  order by xp_week_earned desc, xp_total desc, client_id asc
  limit 1;

  if winner.id is null then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'empty');
  end if;

  perform set_config('app.economy_write', '1', true);

  update public.customers
  set
    stamp_count = coalesce(stamp_count, 0) + 1,
    updated_at = now()
  where id = winner.id;

  insert into public.weekly_stamp_awards (tenant_id, week_start, client_id, xp_earned)
  values (p_tenant_id, previous_week, winner.client_id, winner.xp_week_earned);

  return jsonb_build_object(
    'ok', true,
    'awarded', true,
    'client_id', winner.client_id,
    'xp_earned', winner.xp_week_earned,
    'week_start', previous_week
  );
end;
$$;

revoke all on function public.settle_weekly_leader_stamp(text) from public, anon, authenticated;
