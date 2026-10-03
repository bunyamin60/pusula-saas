create table if not exists public.claimed_rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  code text not null,
  table_id text,
  reward_text text,
  status text not null default 'active'
    check (status in ('active', 'redeemed')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (tenant_id, code)
);

create index if not exists claimed_rewards_lookup_idx
  on public.claimed_rewards (tenant_id, code);

alter table public.claimed_rewards enable row level security;

revoke insert, update, delete, select on public.claimed_rewards
  from anon, authenticated;

create or replace function public.register_claimed_reward(
  p_tenant_id text,
  p_code text,
  p_table_id text default null,
  p_reward_text text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(trim(p_code)) not between 6 and 32 then
    raise exception 'invalid_claimed_reward';
  end if;

  insert into public.claimed_rewards (
    tenant_id,
    code,
    table_id,
    reward_text,
    status
  )
  values (
    trim(p_tenant_id),
    upper(trim(p_code)),
    nullif(trim(coalesce(p_table_id, '')), ''),
    nullif(trim(coalesce(p_reward_text, '')), ''),
    'active'
  )
  on conflict (tenant_id, code) do nothing;
end;
$$;

create or replace function public.redeem_claimed_reward(
  p_tenant_id text,
  p_code text
)
returns table (
  code text,
  table_id text,
  reward_text text,
  status text,
  outcome text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current public.claimed_rewards%rowtype;
begin
  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(trim(p_code)) not between 6 and 32 then
    return query
    select
      upper(trim(p_code)),
      null::text,
      null::text,
      'active'::text,
      'missing'::text;
    return;
  end if;

  select * into current
  from public.claimed_rewards as rewards
  where rewards.tenant_id = trim(p_tenant_id)
    and rewards.code = upper(trim(p_code))
  for update;

  if not found then
    return query
    select
      upper(trim(p_code)),
      null::text,
      null::text,
      'active'::text,
      'missing'::text;
    return;
  end if;

  if current.status = 'redeemed' then
    return query
    select
      current.code,
      current.table_id,
      current.reward_text,
      current.status,
      'used'::text;
    return;
  end if;

  update public.claimed_rewards
  set
    status = 'redeemed',
    redeemed_at = now()
  where id = current.id;

  return query
  select
    current.code,
    current.table_id,
    current.reward_text,
    'redeemed'::text,
    'ok'::text;
end;
$$;

revoke all on function public.register_claimed_reward(text, text, text, text)
  from public;
grant execute on function public.register_claimed_reward(text, text, text, text)
  to anon, authenticated;

revoke all on function public.redeem_claimed_reward(text, text) from public;
grant execute on function public.redeem_claimed_reward(text, text)
  to anon, authenticated;
