-- Fix PL/pgSQL output-column ambiguity in touch_guest_table_session().
-- The function returns game_type and game_started_at, so unqualified uses of
-- those names inside UPDATE were resolved ambiguously at runtime.

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

    update public.guest_table_sessions as gts
       set last_seen_at = v_now,
           nickname = coalesce(
               nullif(left(trim(p_nickname), 32), ''),
               gts.nickname
           ),
           game_type = case
               when v_action = 'start' then nullif(left(trim(p_game_type), 64), '')
               when v_action = 'end' then null
               else gts.game_type
           end,
           game_started_at = case
               when v_action = 'start' and nullif(trim(p_game_type), '') is not null then v_now
               when v_action = 'end' then null
               else gts.game_started_at
           end
     where gts.id = v_session_id
    returning gts.game_type, gts.game_started_at
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

revoke all on function public.touch_guest_table_session(uuid, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.touch_guest_table_session(uuid, text, text, text, text)
to service_role;
