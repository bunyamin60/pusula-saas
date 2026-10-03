-- Trust boundary: anon cannot mint stamps, XP, or ikram coupons.
-- Economy mutations go through service-role API calls.

-- ─── Zero economy fields on client inserts ───────────────────────────────────
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
    new.stamp_last_approved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_customer_economy_insert on public.customers;
create trigger trg_protect_customer_economy_insert
  before insert on public.customers
  for each row
  execute function public.protect_customer_economy_insert();

-- ─── Profile writes that cannot touch stamps or XP ───────────────────────────
create or replace function public.save_customer_profile(
  p_tenant_id text,
  p_client_id text,
  p_nickname text,
  p_pin_code text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customers (
    tenant_id, client_id, nickname, pin_code, avatar_url
  ) values (
    p_tenant_id,
    p_client_id,
    nullif(trim(p_nickname), ''),
    nullif(trim(p_pin_code), ''),
    nullif(trim(p_avatar_url), '')
  )
  on conflict (tenant_id, client_id) do update
  set
    nickname = coalesce(excluded.nickname, public.customers.nickname),
    pin_code = coalesce(excluded.pin_code, public.customers.pin_code),
    avatar_url = coalesce(excluded.avatar_url, public.customers.avatar_url),
    updated_at = now();
end;
$$;

create or replace function public.park_customer_client(
  p_tenant_id text,
  p_client_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set
    client_id = left('parked_' || p_client_id || '_' || extract(epoch from now())::bigint::text, 120),
    updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
end;
$$;

create or replace function public.rebind_customer_client(
  p_tenant_id text,
  p_from_client_id text,
  p_to_client_id text,
  p_nickname text,
  p_pin_code text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set
    client_id = p_to_client_id,
    nickname = coalesce(nullif(trim(p_nickname), ''), nickname),
    pin_code = coalesce(nullif(trim(p_pin_code), ''), pin_code),
    avatar_url = coalesce(nullif(trim(p_avatar_url), ''), avatar_url),
    updated_at = now()
  where tenant_id = p_tenant_id
    and client_id = p_from_client_id;
end;
$$;

grant execute on function public.save_customer_profile(text, text, text, text, text) to anon, authenticated;
grant execute on function public.park_customer_client(text, text) to anon, authenticated;
grant execute on function public.rebind_customer_client(text, text, text, text, text, text) to anon, authenticated;

-- ─── Play session (server-owned elapsed time) ────────────────────────────────
create table if not exists public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  device_id text not null,
  elapsed_seconds integer not null default 0,
  last_heartbeat_at timestamptz,
  coupon_code text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, device_id)
);

alter table public.play_sessions enable row level security;
revoke all on public.play_sessions from anon, authenticated;

create or replace function public.touch_play_session(
  p_tenant_id text,
  p_device_id text,
  p_playing boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.play_sessions;
  target_seconds integer;
  credit integer := 0;
  delta_seconds integer;
  code text;
  table_label text;
begin
  select least(45, greatest(1, coalesce(countdown_minutes, 20))) * 60
    into target_seconds
  from public.tenant_settings
  where id = p_tenant_id;
  if target_seconds is null then
    target_seconds := 20 * 60;
  end if;

  insert into public.play_sessions (tenant_id, device_id, elapsed_seconds, last_heartbeat_at)
  values (p_tenant_id, p_device_id, 0, now())
  on conflict (tenant_id, device_id) do nothing;

  select * into sess
  from public.play_sessions
  where tenant_id = p_tenant_id and device_id = p_device_id
  for update;

  if coalesce(p_playing, false) and sess.last_heartbeat_at is not null then
    delta_seconds := floor(extract(epoch from (now() - sess.last_heartbeat_at)));
    if delta_seconds > 0 then
      credit := least(delta_seconds, 15);
    end if;
  end if;

  update public.play_sessions
  set
    elapsed_seconds = least(target_seconds, sess.elapsed_seconds + credit),
    last_heartbeat_at = now(),
    updated_at = now()
  where id = sess.id
  returning * into sess;

  if sess.elapsed_seconds >= target_seconds and sess.coupon_code is null then
    code := 'ARADA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    select case
      when table_code ~ '^[0-9]+$' then 'Masa #' || table_code
      else 'Masa ' || table_code
    end
      into table_label
    from public.table_sessions
    where tenant_id = p_tenant_id
      and client_id = p_device_id
      and status = 'active'
    order by last_seen_at desc
    limit 1;

    insert into public.reward_coupons (tenant_id, coupon_code, table_id, reward_text, status)
    values (p_tenant_id, code, table_label, 'Sure ikrami', 'ACTIVE')
    on conflict (tenant_id, coupon_code) do nothing;

    update public.play_sessions
    set coupon_code = code, updated_at = now()
    where id = sess.id
    returning * into sess;
  end if;

  return jsonb_build_object(
    'ok', true,
    'elapsed_seconds', sess.elapsed_seconds,
    'target_seconds', target_seconds,
    'unlocked', sess.coupon_code is not null,
    'coupon_code', sess.coupon_code
  );
end;
$$;

revoke all on function public.touch_play_session(text, text, boolean) from public;
revoke all on function public.touch_play_session(text, text, boolean) from anon, authenticated;

-- ─── Close anon economy writes ───────────────────────────────────────────────
revoke insert, update, delete on public.customers from anon, authenticated;
revoke insert, update, delete on public.stamp_requests from anon, authenticated;
revoke insert, update, delete on public.stamp_redeem_proofs from anon, authenticated;
revoke insert, update, delete on public.reward_coupons from anon, authenticated;

revoke all on function public.award_xp(text, text, text, integer) from anon, authenticated;
revoke all on function public.create_stamp_request(text, text, text) from anon, authenticated;
revoke all on function public.approve_stamp_request(text, uuid) from anon, authenticated;
revoke all on function public.redeem_stamp_reward(text, text) from anon, authenticated;
revoke all on function public.join_table_session(text, text, text, text) from anon, authenticated;

grant select on public.customers to anon, authenticated;
grant select on public.stamp_requests to anon, authenticated;
grant select on public.stamp_redeem_proofs to anon, authenticated;
grant select on public.reward_coupons to anon, authenticated;
