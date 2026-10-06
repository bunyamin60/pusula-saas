-- =========================================================
-- ARADA KAHVE V2 - GUEST, VENUE VERIFICATION AND TABLE SESSION
-- This migration is intentionally self-contained because it has not been
-- applied yet. A signed server cookie owns the guest UUID; a table session and
-- a venue verification remain separate concepts.
-- =========================================================

alter table public.venues
    add column latitude double precision,
    add column longitude double precision,
    add column verification_radius_m integer not null default 150,
    add column verification_max_accuracy_m integer not null default 100,
    add column verification_ttl_minutes integer not null default 30,
    add constraint venues_latitude_range
        check (latitude is null or latitude between -90 and 90),
    add constraint venues_longitude_range
        check (longitude is null or longitude between -180 and 180),
    add constraint venues_coordinates_complete
        check ((latitude is null) = (longitude is null)),
    add constraint venues_verification_radius_range
        check (verification_radius_m between 10 and 5000),
    add constraint venues_verification_accuracy_range
        check (verification_max_accuracy_m between 5 and 1000),
    add constraint venues_verification_ttl_range
        check (verification_ttl_minutes between 5 and 1440);

create table public.guest_sessions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

create table public.guest_venue_verifications (
    id uuid primary key default gen_random_uuid(),
    guest_id uuid not null
        references public.guest_sessions(id)
        on delete cascade,
    venue_id uuid not null
        references public.venues(id)
        on delete cascade,
    verification_method text not null,
    verified_at timestamptz not null default now(),
    expires_at timestamptz not null,
    accuracy_m double precision,
    distance_m double precision,
    created_at timestamptz not null default now(),
    unique (guest_id, venue_id),
    check (char_length(verification_method) between 1 and 32),
    check (expires_at >= verified_at),
    check (accuracy_m is null or accuracy_m >= 0),
    check (distance_m is null or distance_m >= 0)
);

create table public.guest_table_sessions (
    id uuid primary key default gen_random_uuid(),
    guest_id uuid not null
        references public.guest_sessions(id)
        on delete cascade,
    venue_table_id uuid not null
        references public.venue_tables(id)
        on delete restrict,
    status text not null default 'active'
        check (status in ('active', 'ended')),
    nickname text,
    game_type text,
    game_started_at timestamptz,
    started_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    ended_at timestamptz,
    check (nickname is null or char_length(nickname) <= 32),
    check (game_type is null or char_length(game_type) <= 64)
);

create index guest_venue_verifications_lookup_idx
    on public.guest_venue_verifications (guest_id, venue_id, expires_at desc);

create unique index guest_table_sessions_one_active_per_guest
    on public.guest_table_sessions (guest_id)
    where status = 'active';

create index guest_table_sessions_table_live_idx
    on public.guest_table_sessions (venue_table_id, status, last_seen_at desc);

create index guest_table_sessions_guest_recent_idx
    on public.guest_table_sessions (guest_id, last_seen_at desc);

alter table public.guest_sessions enable row level security;
alter table public.guest_venue_verifications enable row level security;
alter table public.guest_table_sessions enable row level security;

revoke all on table public.guest_sessions from public, anon, authenticated;
revoke all on table public.guest_venue_verifications from public, anon, authenticated;
revoke all on table public.guest_table_sessions from public, anon, authenticated;

grant select, insert, update on table public.guest_sessions to service_role;
grant select, insert, update on table public.guest_venue_verifications to service_role;
grant select, insert, update on table public.guest_table_sessions to service_role;

-- Validate the QR and venue proximity, then atomically move the guest to the
-- table. A current verification for the same venue can be reused until expiry.
create or replace function public.join_guest_table(
    p_guest_id uuid,
    p_venue_slug text,
    p_public_token uuid,
    p_latitude double precision default null,
    p_longitude double precision default null,
    p_accuracy_m double precision default null
)
returns table (
    verification_status text,
    session_id uuid,
    table_id uuid,
    table_name text,
    venue_id uuid,
    venue_slug text,
    switched_table boolean,
    venue_verified boolean,
    verification_expires_at timestamptz,
    verification_method text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_table_id uuid;
    v_table_name text;
    v_venue_id uuid;
    v_venue_slug text;
    v_venue_latitude double precision;
    v_venue_longitude double precision;
    v_radius_m integer;
    v_max_accuracy_m integer;
    v_ttl_minutes integer;
    v_session_id uuid;
    v_previous_table_id uuid;
    v_verification_expires_at timestamptz;
    v_verification_method text;
    v_distance_m double precision;
    v_now timestamptz := now();
begin
    if p_guest_id is null or p_public_token is null or nullif(trim(p_venue_slug), '') is null then
        return query select
            'invalid_request'::text, null::uuid, null::uuid, null::text,
            null::uuid, null::text, false, false, null::timestamptz, null::text;
        return;
    end if;

    select vt.id, vt.name, v.id, v.slug, v.latitude, v.longitude,
           v.verification_radius_m, v.verification_max_accuracy_m,
           v.verification_ttl_minutes
      into v_table_id, v_table_name, v_venue_id, v_venue_slug,
           v_venue_latitude, v_venue_longitude, v_radius_m,
           v_max_accuracy_m, v_ttl_minutes
      from public.venue_tables vt
      join public.venues v on v.id = vt.venue_id
     where vt.public_token = p_public_token
       and vt.is_active = true
       and v.is_active = true
       and v.slug = lower(trim(p_venue_slug))
     limit 1;

    if not found then
        return query select
            'invalid_table'::text, null::uuid, null::uuid, null::text,
            null::uuid, null::text, false, false, null::timestamptz, null::text;
        return;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

    insert into public.guest_sessions (id, last_seen_at)
    values (p_guest_id, v_now)
    on conflict (id) do update
      set last_seen_at = excluded.last_seen_at;

    select gvv.expires_at, gvv.verification_method
      into v_verification_expires_at, v_verification_method
      from public.guest_venue_verifications gvv
     where gvv.guest_id = p_guest_id
       and gvv.venue_id = v_venue_id
       and gvv.expires_at > v_now
     limit 1;

    if v_verification_expires_at is null then
        if v_venue_latitude is null or v_venue_longitude is null then
            return query select
                'venue_location_unconfigured'::text, null::uuid, v_table_id,
                v_table_name, v_venue_id, v_venue_slug, false, false,
                null::timestamptz, null::text;
            return;
        end if;

        if p_latitude is null or p_longitude is null or p_accuracy_m is null then
            return query select
                'location_required'::text, null::uuid, v_table_id,
                v_table_name, v_venue_id, v_venue_slug, false, false,
                null::timestamptz, null::text;
            return;
        end if;

        if p_latitude < -90 or p_latitude > 90
           or p_longitude < -180 or p_longitude > 180
           or p_accuracy_m < 0 then
            return query select
                'invalid_location'::text, null::uuid, v_table_id,
                v_table_name, v_venue_id, v_venue_slug, false, false,
                null::timestamptz, null::text;
            return;
        end if;

        if p_accuracy_m > v_max_accuracy_m then
            return query select
                'inaccurate_location'::text, null::uuid, v_table_id,
                v_table_name, v_venue_id, v_venue_slug, false, false,
                null::timestamptz, null::text;
            return;
        end if;

        -- Haversine distance in metres. The decision is made only here, never
        -- from a client-provided distance or boolean.
        v_distance_m := 6371000.0 * 2.0 * asin(
            least(
                1.0,
                sqrt(
                    power(sin(radians(p_latitude - v_venue_latitude) / 2.0), 2)
                    + cos(radians(v_venue_latitude))
                    * cos(radians(p_latitude))
                    * power(sin(radians(p_longitude - v_venue_longitude) / 2.0), 2)
                )
            )
        );

        if v_distance_m > v_radius_m then
            return query select
                'outside_venue'::text, null::uuid, v_table_id,
                v_table_name, v_venue_id, v_venue_slug, false, false,
                null::timestamptz, null::text;
            return;
        end if;

        v_verification_expires_at := v_now + make_interval(mins => v_ttl_minutes);
        v_verification_method := 'geolocation';

        insert into public.guest_venue_verifications (
            guest_id,
            venue_id,
            verification_method,
            verified_at,
            expires_at,
            accuracy_m,
            distance_m
        )
        values (
            p_guest_id,
            v_venue_id,
            v_verification_method,
            v_now,
            v_verification_expires_at,
            p_accuracy_m,
            v_distance_m
        )
        on conflict (guest_id, venue_id) do update
          set verification_method = excluded.verification_method,
              verified_at = excluded.verified_at,
              expires_at = excluded.expires_at,
              accuracy_m = excluded.accuracy_m,
              distance_m = excluded.distance_m;
    end if;

    -- A guest can hold a current verification for only the venue they most
    -- recently entered. Rows are retained for audit but explicitly expired.
    update public.guest_venue_verifications
       set expires_at = v_now
     where guest_id = p_guest_id
       and venue_id <> v_venue_id
       and expires_at > v_now;

    select gts.id, gts.venue_table_id
      into v_session_id, v_previous_table_id
      from public.guest_table_sessions gts
     where gts.guest_id = p_guest_id
       and gts.status = 'active'
     for update;

    if v_session_id is not null and v_previous_table_id = v_table_id then
        update public.guest_table_sessions
           set last_seen_at = v_now
         where id = v_session_id;
    else
        update public.guest_table_sessions
           set status = 'ended',
               ended_at = v_now,
               last_seen_at = v_now,
               game_type = null,
               game_started_at = null
         where guest_id = p_guest_id
           and status = 'active';

        insert into public.guest_table_sessions (
            guest_id,
            venue_table_id,
            started_at,
            last_seen_at
        )
        values (p_guest_id, v_table_id, v_now, v_now)
        returning id into v_session_id;
    end if;

    return query select
        'joined'::text,
        v_session_id,
        v_table_id,
        v_table_name,
        v_venue_id,
        v_venue_slug,
        v_previous_table_id is not null and v_previous_table_id <> v_table_id,
        true,
        v_verification_expires_at,
        v_verification_method;
end;
$$;

-- Renew an expired venue verification without asking for the physical QR
-- again. The signed guest identity identifies the active table session; no
-- guest, venue or table identifier is accepted from the browser.
create or replace function public.reverify_guest_venue(
    p_guest_id uuid,
    p_venue_slug text,
    p_latitude double precision,
    p_longitude double precision,
    p_accuracy_m double precision
)
returns table (
    verification_status text,
    session_id uuid,
    table_id uuid,
    table_name text,
    venue_id uuid,
    venue_slug text,
    switched_table boolean,
    venue_verified boolean,
    verification_expires_at timestamptz,
    verification_method text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_public_token uuid;
begin
    if p_guest_id is null or nullif(trim(p_venue_slug), '') is null then
        return query select
            'invalid_request'::text, null::uuid, null::uuid, null::text,
            null::uuid, null::text, false, false, null::timestamptz, null::text;
        return;
    end if;

    select vt.public_token
      into v_public_token
      from public.guest_table_sessions gts
      join public.venue_tables vt on vt.id = gts.venue_table_id
      join public.venues v on v.id = vt.venue_id
     where gts.guest_id = p_guest_id
       and gts.status = 'active'
       and vt.is_active = true
       and v.is_active = true
       and v.slug = lower(trim(p_venue_slug))
     limit 1;

    if not found then
        return query select
            'active_session_required'::text, null::uuid, null::uuid, null::text,
            null::uuid, null::text, false, false, null::timestamptz, null::text;
        return;
    end if;

    return query
    select *
      from public.join_guest_table(
          p_guest_id,
          p_venue_slug,
          v_public_token,
          p_latitude,
          p_longitude,
          p_accuracy_m
      );
end;
$$;

-- Touching a table session never asks for location and never extends the
-- verification TTL. Consumers can use venue_verified to gate venue-wide work.
create or replace function public.touch_guest_table_session(
    p_guest_id uuid,
    p_venue_slug text,
    p_action text default 'touch',
    p_nickname text default null,
    p_game_type text default null
)
returns table (
    session_id uuid,
    table_id uuid,
    table_name text,
    venue_id uuid,
    venue_slug text,
    game_type text,
    game_started_at timestamptz,
    venue_verified boolean,
    verification_expires_at timestamptz,
    verification_method text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_session_id uuid;
    v_table_id uuid;
    v_table_name text;
    v_venue_id uuid;
    v_venue_slug text;
    v_game_type text;
    v_game_started_at timestamptz;
    v_verification_expires_at timestamptz;
    v_verification_method text;
    v_now timestamptz := now();
    v_action text := lower(trim(coalesce(p_action, 'touch')));
begin
    if p_guest_id is null
       or nullif(trim(p_venue_slug), '') is null
       or v_action not in ('touch', 'start', 'end') then
        return;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

    insert into public.guest_sessions (id, last_seen_at)
    values (p_guest_id, v_now)
    on conflict (id) do update
      set last_seen_at = excluded.last_seen_at;

    update public.guest_table_sessions gts
       set status = 'ended',
           ended_at = v_now,
           last_seen_at = v_now,
           game_type = null,
           game_started_at = null
      from public.venue_tables vt
      join public.venues v on v.id = vt.venue_id
     where gts.venue_table_id = vt.id
       and gts.guest_id = p_guest_id
       and gts.status = 'active'
       and v.slug = lower(trim(p_venue_slug))
       and (vt.is_active = false or v.is_active = false);

    select gts.id, vt.id, vt.name, v.id, v.slug,
           gts.game_type, gts.game_started_at,
           gvv.expires_at, gvv.verification_method
      into v_session_id, v_table_id, v_table_name, v_venue_id, v_venue_slug,
           v_game_type, v_game_started_at,
           v_verification_expires_at, v_verification_method
      from public.guest_table_sessions gts
      join public.venue_tables vt on vt.id = gts.venue_table_id
      join public.venues v on v.id = vt.venue_id
      left join public.guest_venue_verifications gvv
        on gvv.guest_id = gts.guest_id
       and gvv.venue_id = v.id
       and gvv.expires_at > v_now
     where gts.guest_id = p_guest_id
       and gts.status = 'active'
       and vt.is_active = true
       and v.is_active = true
       and v.slug = lower(trim(p_venue_slug))
     for update of gts;

    if not found then
        return;
    end if;

    update public.guest_table_sessions
       set last_seen_at = v_now,
           nickname = coalesce(nullif(left(trim(p_nickname), 32), ''), nickname),
           game_type = case
               when v_action = 'start' then nullif(left(trim(p_game_type), 64), '')
               when v_action = 'end' then null
               else game_type
           end,
           game_started_at = case
               when v_action = 'start' and nullif(trim(p_game_type), '') is not null then v_now
               when v_action = 'end' then null
               else game_started_at
           end
     where id = v_session_id
    returning guest_table_sessions.game_type, guest_table_sessions.game_started_at
         into v_game_type, v_game_started_at;

    return query select
        v_session_id,
        v_table_id,
        v_table_name,
        v_venue_id,
        v_venue_slug,
        v_game_type,
        v_game_started_at,
        v_verification_expires_at is not null,
        v_verification_expires_at,
        v_verification_method;
end;
$$;

revoke all on function public.join_guest_table(
    uuid, text, uuid, double precision, double precision, double precision
) from public, anon, authenticated;
revoke all on function public.reverify_guest_venue(
    uuid, text, double precision, double precision, double precision
) from public, anon, authenticated;
revoke all on function public.touch_guest_table_session(uuid, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.join_guest_table(
    uuid, text, uuid, double precision, double precision, double precision
) to service_role;
grant execute on function public.reverify_guest_venue(
    uuid, text, double precision, double precision, double precision
) to service_role;
grant execute on function public.touch_guest_table_session(uuid, text, text, text, text)
to service_role;
