-- Live schema: tenant_settings holds venue config; reward_coupons holds kasa codes.

alter table public.tenant_settings
  add column if not exists active_games jsonb;

update public.tenant_settings
set active_games = coalesce(active_games, enabled_games)
where active_games is null
  and enabled_games is not null;

drop function if exists public.get_venue_settings(text);
drop function if exists public.upsert_venue_settings(text, integer, text, jsonb);
drop function if exists public.register_reward_coupon(text, text, text, text);
drop function if exists public.redeem_reward_coupon(text, text);
drop function if exists public.list_today_redeemed_coupons(text);
drop function if exists public.reward_coupon_metrics(text);
drop table if exists public.venue_settings;

create table if not exists public.reward_coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  coupon_code text not null,
  table_id text,
  reward_text text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (tenant_id, coupon_code)
);

create index if not exists reward_coupons_lookup_idx
  on public.reward_coupons (tenant_id, coupon_code);

create index if not exists reward_coupons_redeemed_idx
  on public.reward_coupons (tenant_id, status, redeemed_at desc);

alter table public.reward_coupons enable row level security;

grant select, insert, update on public.reward_coupons to anon, authenticated;

drop policy if exists "reward_coupons_select" on public.reward_coupons;
drop policy if exists "reward_coupons_insert" on public.reward_coupons;
drop policy if exists "reward_coupons_update" on public.reward_coupons;

create policy "reward_coupons_select"
  on public.reward_coupons
  for select
  to anon, authenticated
  using (true);

create policy "reward_coupons_insert"
  on public.reward_coupons
  for insert
  to anon, authenticated
  with check (true);

create policy "reward_coupons_update"
  on public.reward_coupons
  for update
  to anon, authenticated
  using (true)
  with check (true);
