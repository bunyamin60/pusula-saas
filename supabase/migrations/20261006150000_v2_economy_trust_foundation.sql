-- V2 economy trust foundation.
-- Guest identity comes from the signed server cookie, while this database layer
-- derives venue/table context from the guest's fresh V2 table session.

create table public.guest_play_sessions (
    id uuid primary key default gen_random_uuid(),
    guest_id uuid not null
        references public.guest_sessions(id)
        on delete cascade,
    venue_id uuid not null
        references public.venues(id)
        on delete cascade,
    guest_table_session_id uuid
        references public.guest_table_sessions(id)
        on delete set null,
    elapsed_seconds integer not null default 0
        check (elapsed_seconds >= 0),
    last_heartbeat_at timestamptz,
    coupon_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (guest_id, venue_id)
);

create index guest_play_sessions_venue_recent_idx
    on public.guest_play_sessions (venue_id, last_heartbeat_at desc);

create table public.venue_xp_configs (
    id uuid primary key default gen_random_uuid(),
    venue_id uuid not null
        references public.venues(id)
        on delete cascade,
    activity_name text not null,
    label text not null default '',
    base_xp integer not null default 0
        check (base_xp between 0 and 100),
    multiplier double precision not null default 0
        check (multiplier between 0 and 10),
    max_xp_per_action integer not null default 100
        check (max_xp_per_action between 1 and 100),
    cooldown_seconds integer not null default 60
        check (cooldown_seconds between 0 and 86400),
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (venue_id, activity_name)
);

create table public.guest_xp_accounts (
    id uuid primary key default gen_random_uuid(),
    guest_id uuid not null
        references public.guest_sessions(id)
        on delete cascade,
    venue_id uuid not null
        references public.venues(id)
        on delete cascade,
    xp_total integer not null default 0
        check (xp_total >= 0),
    xp_day date,
    xp_day_earned integer not null default 0
        check (xp_day_earned >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (guest_id, venue_id)
);

create table public.guest_xp_events (
    id uuid primary key default gen_random_uuid(),
    guest_id uuid not null
        references public.guest_sessions(id)
        on delete cascade,
    venue_id uuid not null
        references public.venues(id)
        on delete cascade,
    guest_table_session_id uuid
        references public.guest_table_sessions(id)
        on delete set null,
    activity_name text not null,
    submitted_score integer,
    computed_xp integer not null
        check (computed_xp >= 0),
    granted_xp integer not null
        check (granted_xp >= 0),
    awarded_at timestamptz not null default now()
);

create index guest_xp_events_cooldown_idx
    on public.guest_xp_events (
        guest_id,
        venue_id,
        activity_name,
        awarded_at desc
    );

alter table public.guest_play_sessions enable row level security;
alter table public.venue_xp_configs enable row level security;
alter table public.guest_xp_accounts enable row level security;
alter table public.guest_xp_events enable row level security;

revoke all on table public.guest_play_sessions from public, anon, authenticated;
revoke all on table public.venue_xp_configs from public, anon, authenticated;
revoke all on table public.guest_xp_accounts from public, anon, authenticated;
revoke all on table public.guest_xp_events from public, anon, authenticated;

grant select, insert, update, delete on table public.guest_play_sessions to service_role;
grant select, insert, update on table public.venue_xp_configs to service_role;
grant select, insert, update on table public.guest_xp_accounts to service_role;
grant select, insert on table public.guest_xp_events to service_role;

create or replace function public.seed_default_venue_xp_configs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.venue_xp_configs (
        venue_id,
        activity_name,
        label,
        base_xp,
        multiplier,
        max_xp_per_action,
        cooldown_seconds
    )
    values
        (new.id, 'gunun_sorusu', 'Günün Sorusu', 10, 0, 10, 86400),
        (new.id, 'quiz', 'Bilgi Yarışması', 0, 0.15, 40, 60),
        (new.id, 'blockblast', 'Block Blast', 0, 0.02, 40, 60),
        (new.id, 'taboo', 'Tabu', 15, 0, 15, 300),
        (new.id, 'whoami', 'Ben Kimim', 15, 0, 15, 300),
        (new.id, 'draw', 'Çiz & Bil', 20, 0, 20, 300),
        (new.id, 'mini_oyun', 'Mini Oyun', 10, 0, 10, 300)
    on conflict (venue_id, activity_name) do nothing;

    return new;
end;
$$;

create trigger venues_seed_default_xp_configs
after insert on public.venues
for each row
execute function public.seed_default_venue_xp_configs();

insert into public.venue_xp_configs (
    venue_id,
    activity_name,
    label,
    base_xp,
    multiplier,
    max_xp_per_action,
    cooldown_seconds
)
select
    v.id,
    defaults.activity_name,
    defaults.label,
    defaults.base_xp,
    defaults.multiplier,
    defaults.max_xp_per_action,
    defaults.cooldown_seconds
from public.venues as v
cross join (
    values
        ('gunun_sorusu', 'Günün Sorusu', 10, 0::double precision, 10, 86400),
        ('quiz', 'Bilgi Yarışması', 0, 0.15::double precision, 40, 60),
        ('blockblast', 'Block Blast', 0, 0.02::double precision, 40, 60),
        ('taboo', 'Tabu', 15, 0::double precision, 15, 300),
        ('whoami', 'Ben Kimim', 15, 0::double precision, 15, 300),
        ('draw', 'Çiz & Bil', 20, 0::double precision, 20, 300),
        ('mini_oyun', 'Mini Oyun', 10, 0::double precision, 10, 300)
) as defaults(
    activity_name,
    label,
    base_xp,
    multiplier,
    max_xp_per_action,
    cooldown_seconds
)
on conflict (venue_id, activity_name) do nothing;

create or replace function public.touch_guest_play_session(
    p_guest_id uuid,
    p_playing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_table_session_id uuid;
    v_venue_id uuid;
    v_verified boolean := false;
    v_session public.guest_play_sessions;
    v_delta_seconds integer := 0;
    v_credit_seconds integer := 0;
    v_target_seconds constant integer := 1200;
begin
    if p_guest_id is null then
        return jsonb_build_object(
            'ok', false,
            'reason', 'invalid_guest',
            'accrual_allowed', false,
            'elapsed_seconds', 0,
            'target_seconds', v_target_seconds,
            'unlocked', false,
            'coupon_code', null
        );
    end if;

    select gts.id, vt.venue_id
      into v_table_session_id, v_venue_id
      from public.guest_table_sessions as gts
      join public.venue_tables as vt
        on vt.id = gts.venue_table_id
       and vt.is_active = true
      join public.venues as v
        on v.id = vt.venue_id
       and v.is_active = true
     where gts.guest_id = p_guest_id
       and gts.status = 'active'
       and gts.last_seen_at >= v_now - interval '2 minutes'
     order by gts.last_seen_at desc
     limit 1;

    if v_table_session_id is null then
        return jsonb_build_object(
            'ok', true,
            'reason', 'active_session_required',
            'accrual_allowed', false,
            'elapsed_seconds', 0,
            'target_seconds', v_target_seconds,
            'unlocked', false,
            'coupon_code', null
        );
    end if;

    select exists (
        select 1
          from public.guest_venue_verifications as gvv
         where gvv.guest_id = p_guest_id
           and gvv.venue_id = v_venue_id
           and gvv.expires_at > v_now
    ) into v_verified;

    insert into public.guest_play_sessions (
        guest_id,
        venue_id,
        guest_table_session_id,
        last_heartbeat_at
    )
    values (
        p_guest_id,
        v_venue_id,
        v_table_session_id,
        v_now
    )
    on conflict (guest_id, venue_id) do nothing;

    select *
      into v_session
      from public.guest_play_sessions as gps
     where gps.guest_id = p_guest_id
       and gps.venue_id = v_venue_id
     for update;

    if not v_verified then
        update public.guest_play_sessions as gps
           set guest_table_session_id = v_table_session_id,
               last_heartbeat_at = v_now,
               updated_at = v_now
         where gps.id = v_session.id
        returning * into v_session;

        return jsonb_build_object(
            'ok', true,
            'reason', 'venue_verification_required',
            'accrual_allowed', false,
            'elapsed_seconds', v_session.elapsed_seconds,
            'target_seconds', v_target_seconds,
            'unlocked', v_session.coupon_code is not null,
            'coupon_code', v_session.coupon_code
        );
    end if;

    if coalesce(p_playing, false)
       and v_session.guest_table_session_id = v_table_session_id
       and v_session.last_heartbeat_at is not null then
        v_delta_seconds := floor(
            extract(epoch from (v_now - v_session.last_heartbeat_at))
        );

        if v_delta_seconds between 1 and 30 then
            v_credit_seconds := least(v_delta_seconds, 15);
        end if;
    end if;

    update public.guest_play_sessions as gps
       set guest_table_session_id = v_table_session_id,
           elapsed_seconds = least(
               v_target_seconds,
               gps.elapsed_seconds + v_credit_seconds
           ),
           last_heartbeat_at = v_now,
           updated_at = v_now
     where gps.id = v_session.id
    returning * into v_session;

    return jsonb_build_object(
        'ok', true,
        'accrual_allowed', true,
        'elapsed_seconds', v_session.elapsed_seconds,
        'credited_seconds', v_credit_seconds,
        'target_seconds', v_target_seconds,
        'unlocked', v_session.coupon_code is not null,
        'coupon_code', v_session.coupon_code
    );
end;
$$;

create or replace function public.award_guest_xp(
    p_guest_id uuid,
    p_activity_name text,
    p_score integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_today date := (timezone('Europe/Istanbul', v_now))::date;
    v_daily_cap constant integer := 100;
    v_table_session_id uuid;
    v_venue_id uuid;
    v_config public.venue_xp_configs;
    v_account public.guest_xp_accounts;
    v_last_awarded_at timestamptz;
    v_score integer;
    v_computed integer;
    v_granted integer;
    v_day_earned integer;
    v_remaining integer;
    v_play_eligible boolean;
begin
    if p_guest_id is null or nullif(trim(p_activity_name), '') is null then
        return jsonb_build_object(
            'ok', false,
            'reason', 'invalid',
            'granted', 0,
            'accrual_allowed', false
        );
    end if;

    select gts.id, vt.venue_id
      into v_table_session_id, v_venue_id
      from public.guest_table_sessions as gts
      join public.venue_tables as vt
        on vt.id = gts.venue_table_id
       and vt.is_active = true
      join public.venues as v
        on v.id = vt.venue_id
       and v.is_active = true
     where gts.guest_id = p_guest_id
       and gts.status = 'active'
       and gts.last_seen_at >= v_now - interval '2 minutes'
     order by gts.last_seen_at desc
     limit 1;

    if v_table_session_id is null then
        return jsonb_build_object(
            'ok', true,
            'reason', 'active_session_required',
            'granted', 0,
            'capped', false,
            'daily_cap', v_daily_cap,
            'accrual_allowed', false
        );
    end if;

    if not exists (
        select 1
          from public.guest_venue_verifications as gvv
         where gvv.guest_id = p_guest_id
           and gvv.venue_id = v_venue_id
           and gvv.expires_at > v_now
    ) then
        return jsonb_build_object(
            'ok', true,
            'reason', 'venue_verification_required',
            'granted', 0,
            'capped', false,
            'daily_cap', v_daily_cap,
            'accrual_allowed', false
        );
    end if;

    select *
      into v_config
      from public.venue_xp_configs as vxc
     where vxc.venue_id = v_venue_id
       and vxc.activity_name = trim(p_activity_name)
       and vxc.enabled = true
     limit 1;

    if v_config.id is null then
        return jsonb_build_object(
            'ok', false,
            'reason', 'unknown_activity',
            'granted', 0,
            'accrual_allowed', true
        );
    end if;

    if v_config.activity_name in ('quiz', 'blockblast') then
        select exists (
            select 1
              from public.guest_play_sessions as gps
             where gps.guest_id = p_guest_id
               and gps.venue_id = v_venue_id
               and gps.elapsed_seconds >= 30
               and gps.last_heartbeat_at >= v_now - interval '3 minutes'
        ) into v_play_eligible;

        if not v_play_eligible then
            return jsonb_build_object(
                'ok', true,
                'reason', 'no_play',
                'granted', 0,
                'capped', false,
                'daily_cap', v_daily_cap,
                'accrual_allowed', true
            );
        end if;
    end if;

    insert into public.guest_xp_accounts (guest_id, venue_id)
    values (p_guest_id, v_venue_id)
    on conflict (guest_id, venue_id) do nothing;

    select *
      into v_account
      from public.guest_xp_accounts as gxa
     where gxa.guest_id = p_guest_id
       and gxa.venue_id = v_venue_id
     for update;

    select max(gxe.awarded_at)
      into v_last_awarded_at
      from public.guest_xp_events as gxe
     where gxe.guest_id = p_guest_id
       and gxe.venue_id = v_venue_id
       and gxe.activity_name = v_config.activity_name;

    if v_last_awarded_at is not null
       and v_last_awarded_at + make_interval(secs => v_config.cooldown_seconds) > v_now then
        return jsonb_build_object(
            'ok', true,
            'reason', 'cooldown',
            'granted', 0,
            'capped', false,
            'xp_total', v_account.xp_total,
            'xp_day_earned', case
                when v_account.xp_day = v_today then v_account.xp_day_earned
                else 0
            end,
            'daily_cap', v_daily_cap,
            'retry_at', v_last_awarded_at + make_interval(secs => v_config.cooldown_seconds),
            'accrual_allowed', true
        );
    end if;

    v_score := case
        when p_score is null then null
        else least(1000000, greatest(0, p_score))
    end;

    if v_config.multiplier > 0 and coalesce(v_score, 0) > 0 then
        v_computed := floor(v_score::double precision * v_config.multiplier)::integer;
    else
        v_computed := greatest(0, v_config.base_xp);
    end if;

    v_computed := greatest(0, least(v_computed, v_config.max_xp_per_action));
    if v_computed <= 0 then
        return jsonb_build_object(
            'ok', false,
            'reason', 'zero_xp',
            'granted', 0,
            'accrual_allowed', true
        );
    end if;

    v_day_earned := case
        when v_account.xp_day = v_today then v_account.xp_day_earned
        else 0
    end;
    v_remaining := greatest(0, v_daily_cap - v_day_earned);

    if v_remaining <= 0 then
        return jsonb_build_object(
            'ok', true,
            'reason', 'daily_cap',
            'granted', 0,
            'capped', true,
            'xp_total', v_account.xp_total,
            'xp_day_earned', v_day_earned,
            'daily_cap', v_daily_cap,
            'accrual_allowed', true
        );
    end if;

    v_granted := least(v_computed, v_remaining);

    update public.guest_xp_accounts as gxa
       set xp_total = gxa.xp_total + v_granted,
           xp_day = v_today,
           xp_day_earned = v_day_earned + v_granted,
           updated_at = v_now
     where gxa.id = v_account.id
    returning * into v_account;

    insert into public.guest_xp_events (
        guest_id,
        venue_id,
        guest_table_session_id,
        activity_name,
        submitted_score,
        computed_xp,
        granted_xp,
        awarded_at
    )
    values (
        p_guest_id,
        v_venue_id,
        v_table_session_id,
        v_config.activity_name,
        v_score,
        v_computed,
        v_granted,
        v_now
    );

    return jsonb_build_object(
        'ok', true,
        'capped', v_account.xp_day_earned >= v_daily_cap,
        'granted', v_granted,
        'computed', v_computed,
        'xp_total', v_account.xp_total,
        'xp_day_earned', v_account.xp_day_earned,
        'daily_cap', v_daily_cap,
        'accrual_allowed', true
    );
end;
$$;

revoke all on function public.seed_default_venue_xp_configs() from public, anon, authenticated;
revoke all on function public.touch_guest_play_session(uuid, boolean) from public, anon, authenticated;
revoke all on function public.award_guest_xp(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.touch_guest_play_session(uuid, boolean) to service_role;
grant execute on function public.award_guest_xp(uuid, text, integer) to service_role;
