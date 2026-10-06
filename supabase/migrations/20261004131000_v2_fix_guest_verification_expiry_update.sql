-- Qualify guest verification columns that collide with join_guest_table()
-- output column names. The previous follow-up fixed the upsert conflict target;
-- this migration fixes the cross-venue expiry update found by DEV integration
-- tests without modifying either applied migration.

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
        on conflict on constraint guest_venue_verifications_guest_id_venue_id_key
        do update
          set verification_method = excluded.verification_method,
              verified_at = excluded.verified_at,
              expires_at = excluded.expires_at,
              accuracy_m = excluded.accuracy_m,
              distance_m = excluded.distance_m;
    end if;

    update public.guest_venue_verifications as gvv
       set expires_at = v_now
     where gvv.guest_id = p_guest_id
       and gvv.venue_id <> v_venue_id
       and gvv.expires_at > v_now;

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

revoke all on function public.join_guest_table(
    uuid, text, uuid, double precision, double precision, double precision
) from public, anon, authenticated;

grant execute on function public.join_guest_table(
    uuid, text, uuid, double precision, double precision, double precision
) to service_role;
