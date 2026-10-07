-- V2 venue-scoped game leaderboards and normalized weekly league points.
-- Raw scores remain game-specific. Overall standings use configurable points
-- assigned from each game's deterministic weekly rank.

create table public.leaderboard_game_configs (
    game_key text primary key
        check (game_key ~ '^[a-z0-9_]{2,32}$'),
    label text not null,
    min_raw_score integer not null default 0,
    max_raw_score integer not null,
    result_cooldown_seconds integer not null default 60
        check (result_cooldown_seconds between 0 and 86400),
    eligible_for_league boolean not null default true,
    allowed_categories text[] not null default array['']::text[],
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (max_raw_score >= min_raw_score),
    check (cardinality(allowed_categories) > 0)
);

create table public.league_rank_points (
    rank integer primary key
        check (rank between 1 and 100),
    league_points integer not null
        check (league_points >= 0),
    updated_at timestamptz not null default now()
);

create table public.venue_league_settings (
    venue_id uuid primary key
        references public.venues(id)
        on delete cascade,
    best_game_limit integer not null default 3
        check (best_game_limit between 1 and 10),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.game_results (
    id uuid primary key default gen_random_uuid(),
    venue_id uuid not null
        references public.venues(id)
        on delete cascade,
    guest_id uuid not null
        references public.guest_sessions(id)
        on delete cascade,
    guest_table_session_id uuid not null
        references public.guest_table_sessions(id)
        on delete restrict,
    game_key text not null
        references public.leaderboard_game_configs(game_key)
        on delete restrict,
    category text not null default '',
    raw_score integer not null,
    nickname text not null,
    avatar_url text,
    submission_key uuid not null,
    week_start date not null,
    eligible_for_league boolean not null,
    submitted_at timestamptz not null default now(),
    unique (guest_id, submission_key),
    check (char_length(category) <= 32),
    check (char_length(nickname) between 1 and 64),
    check (avatar_url is null or char_length(avatar_url) <= 160)
);

create index game_results_game_week_rank_idx
    on public.game_results (
        venue_id,
        week_start,
        game_key,
        raw_score desc,
        submitted_at asc
    );

create index game_results_guest_game_recent_idx
    on public.game_results (
        guest_id,
        venue_id,
        game_key,
        submitted_at desc
    );

alter table public.leaderboard_game_configs enable row level security;
alter table public.league_rank_points enable row level security;
alter table public.venue_league_settings enable row level security;
alter table public.game_results enable row level security;

revoke all on table public.leaderboard_game_configs from public, anon, authenticated;
revoke all on table public.league_rank_points from public, anon, authenticated;
revoke all on table public.venue_league_settings from public, anon, authenticated;
revoke all on table public.game_results from public, anon, authenticated;

grant select, insert, update on table public.leaderboard_game_configs to service_role;
grant select, insert, update on table public.league_rank_points to service_role;
grant select, insert, update on table public.venue_league_settings to service_role;
grant select, insert, update on table public.game_results to service_role;

insert into public.leaderboard_game_configs (
    game_key,
    label,
    min_raw_score,
    max_raw_score,
    result_cooldown_seconds,
    eligible_for_league,
    allowed_categories
)
values
    (
        'quiz',
        'Bilgi Yarışması',
        0,
        2000,
        60,
        true,
        array['cafe', 'turkey', 'general', 'sports']::text[]
    ),
    (
        'blockblast',
        'Block Blast',
        0,
        999999,
        60,
        true,
        array['']::text[]
    )
on conflict (game_key) do nothing;

insert into public.league_rank_points (rank, league_points)
values
    (1, 100),
    (2, 70),
    (3, 50),
    (4, 40),
    (5, 35),
    (6, 30),
    (7, 25),
    (8, 20),
    (9, 15),
    (10, 10)
on conflict (rank) do nothing;

insert into public.venue_league_settings (venue_id)
select v.id
from public.venues as v
on conflict (venue_id) do nothing;

create or replace function public.seed_venue_league_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.venue_league_settings (venue_id)
    values (new.id)
    on conflict (venue_id) do nothing;
    return new;
end;
$$;

create trigger venues_seed_league_settings
after insert on public.venues
for each row
execute function public.seed_venue_league_settings();

create or replace function public.submit_game_result(
    p_guest_id uuid,
    p_game_key text,
    p_raw_score integer,
    p_category text default '',
    p_nickname text default null,
    p_avatar_url text default null,
    p_submission_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_week_start date := date_trunc(
        'week',
        timezone('Europe/Istanbul', v_now)
    )::date;
    v_game_key text := lower(trim(coalesce(p_game_key, '')));
    v_category text := lower(trim(coalesce(p_category, '')));
    v_nickname text := coalesce(
        nullif(left(trim(coalesce(p_nickname, '')), 64), ''),
        'Misafir'
    );
    v_avatar_url text := nullif(left(trim(coalesce(p_avatar_url, '')), 160), '');
    v_table_session_id uuid;
    v_venue_id uuid;
    v_config public.leaderboard_game_configs;
    v_existing public.game_results;
    v_latest public.game_results;
    v_result_id uuid;
begin
    if p_guest_id is null or p_submission_key is null then
        return jsonb_build_object(
            'ok', false,
            'accepted', false,
            'reason', 'invalid_request'
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
            'accepted', false,
            'reason', 'active_session_required'
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
            'accepted', false,
            'reason', 'venue_verification_required'
        );
    end if;

    select *
      into v_config
      from public.leaderboard_game_configs as lgc
     where lgc.game_key = v_game_key
       and lgc.is_active = true;

    if v_config.game_key is null then
        return jsonb_build_object(
            'ok', false,
            'accepted', false,
            'reason', 'unknown_game'
        );
    end if;

    if p_raw_score is null
       or p_raw_score < v_config.min_raw_score
       or p_raw_score > v_config.max_raw_score then
        return jsonb_build_object(
            'ok', false,
            'accepted', false,
            'reason', 'invalid_score'
        );
    end if;

    if not (v_category = any(v_config.allowed_categories)) then
        return jsonb_build_object(
            'ok', false,
            'accepted', false,
            'reason', 'invalid_category'
        );
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_guest_id::text || ':' || v_game_key, 0)
    );

    select *
      into v_existing
      from public.game_results as gr
     where gr.guest_id = p_guest_id
       and gr.submission_key = p_submission_key
     limit 1;

    if v_existing.id is not null then
        update public.game_results as gr
           set nickname = v_nickname,
               avatar_url = coalesce(v_avatar_url, gr.avatar_url)
         where gr.id = v_existing.id;

        return jsonb_build_object(
            'ok', true,
            'accepted', true,
            'duplicate', true,
            'result_id', v_existing.id,
            'game_key', v_existing.game_key,
            'week_start', v_existing.week_start
        );
    end if;

    select *
      into v_latest
      from public.game_results as gr
     where gr.guest_id = p_guest_id
       and gr.venue_id = v_venue_id
       and gr.game_key = v_game_key
     order by gr.submitted_at desc
     limit 1;

    if v_latest.id is not null
       and v_latest.submitted_at
           + make_interval(secs => v_config.result_cooldown_seconds) > v_now then
        if v_latest.raw_score = p_raw_score
           and v_latest.category = v_category then
            update public.game_results as gr
               set nickname = v_nickname,
                   avatar_url = coalesce(v_avatar_url, gr.avatar_url)
             where gr.id = v_latest.id;

            return jsonb_build_object(
                'ok', true,
                'accepted', true,
                'duplicate', true,
                'result_id', v_latest.id,
                'game_key', v_latest.game_key,
                'week_start', v_latest.week_start
            );
        end if;

        return jsonb_build_object(
            'ok', true,
            'accepted', false,
            'reason', 'cooldown',
            'retry_at', v_latest.submitted_at
                + make_interval(secs => v_config.result_cooldown_seconds)
        );
    end if;

    insert into public.game_results (
        venue_id,
        guest_id,
        guest_table_session_id,
        game_key,
        category,
        raw_score,
        nickname,
        avatar_url,
        submission_key,
        week_start,
        eligible_for_league,
        submitted_at
    )
    values (
        v_venue_id,
        p_guest_id,
        v_table_session_id,
        v_game_key,
        v_category,
        p_raw_score,
        v_nickname,
        v_avatar_url,
        p_submission_key,
        v_week_start,
        v_config.eligible_for_league,
        v_now
    )
    returning id into v_result_id;

    return jsonb_build_object(
        'ok', true,
        'accepted', true,
        'duplicate', false,
        'result_id', v_result_id,
        'game_key', v_game_key,
        'week_start', v_week_start,
        'eligible_for_league', v_config.eligible_for_league
    );
end;
$$;

create or replace function public.get_guest_game_leaderboard(
    p_guest_id uuid,
    p_game_key text,
    p_category text default null
)
returns table (
    player_key uuid,
    nickname text,
    avatar_url text,
    raw_score integer,
    submitted_at timestamptz,
    rank bigint,
    is_current boolean,
    category text,
    week_start date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_week_start date := date_trunc(
        'week',
        timezone('Europe/Istanbul', v_now)
    )::date;
    v_venue_id uuid;
    v_game_key text := lower(trim(coalesce(p_game_key, '')));
    v_category text := case
        when p_category is null or trim(p_category) = '' then null
        else lower(trim(p_category))
    end;
begin
    select vt.venue_id
      into v_venue_id
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

    if v_venue_id is null or not exists (
        select 1
          from public.leaderboard_game_configs as lgc
         where lgc.game_key = v_game_key
           and lgc.is_active = true
    ) then
        return;
    end if;

    return query
    with scoped as (
        select gr.*
          from public.game_results as gr
         where gr.venue_id = v_venue_id
           and gr.week_start = v_week_start
           and gr.game_key = v_game_key
           and (v_category is null or gr.category = v_category)
    ),
    best as (
        select distinct on (scoped.guest_id)
            scoped.*
          from scoped
         order by
            scoped.guest_id,
            scoped.raw_score desc,
            scoped.submitted_at asc,
            scoped.id asc
    ),
    ranked as (
        select
            best.*,
            row_number() over (
                order by
                    best.raw_score desc,
                    best.submitted_at asc,
                    best.id asc
            )::bigint as leaderboard_rank
          from best
    )
    select
        ranked.id,
        ranked.nickname,
        ranked.avatar_url,
        ranked.raw_score,
        ranked.submitted_at,
        ranked.leaderboard_rank,
        ranked.guest_id = p_guest_id,
        ranked.category,
        ranked.week_start
      from ranked
     where ranked.leaderboard_rank <= 10
        or ranked.guest_id = p_guest_id
     order by ranked.leaderboard_rank;
end;
$$;

create or replace function public.calculate_weekly_league(
    p_venue_id uuid,
    p_week_start date
)
returns table (
    guest_id uuid,
    player_key uuid,
    nickname text,
    avatar_url text,
    total_league_points integer,
    best_game_points integer,
    contributing_games integer,
    first_contribution_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    with best_game_results as (
        select distinct on (gr.guest_id, gr.game_key)
            gr.id,
            gr.guest_id,
            gr.game_key,
            gr.raw_score,
            gr.nickname,
            gr.avatar_url,
            gr.submitted_at
          from public.game_results as gr
         where gr.venue_id = p_venue_id
           and gr.week_start = p_week_start
           and gr.eligible_for_league = true
         order by
            gr.guest_id,
            gr.game_key,
            gr.raw_score desc,
            gr.submitted_at asc,
            gr.id asc
    ),
    ranked_games as (
        select
            bgr.*,
            row_number() over (
                partition by bgr.game_key
                order by
                    bgr.raw_score desc,
                    bgr.submitted_at asc,
                    bgr.id asc
            )::integer as game_rank
          from best_game_results as bgr
    ),
    scored_games as (
        select
            rg.*,
            coalesce(lrp.league_points, 0)::integer as league_points
          from ranked_games as rg
          left join public.league_rank_points as lrp
            on lrp.rank = rg.game_rank
    ),
    contribution_order as (
        select
            sg.*,
            row_number() over (
                partition by sg.guest_id
                order by
                    sg.league_points desc,
                    sg.raw_score desc,
                    sg.game_key asc,
                    sg.submitted_at asc,
                    sg.id asc
            )::integer as contribution_rank
          from scored_games as sg
         where sg.league_points > 0
    ),
    selected as (
        select co.*
          from contribution_order as co
          join public.venue_league_settings as vls
            on vls.venue_id = p_venue_id
         where co.contribution_rank <= vls.best_game_limit
    )
    select
        selected.guest_id,
        (array_agg(selected.id order by selected.id))[1] as player_key,
        (array_agg(
            selected.nickname
            order by selected.submitted_at desc, selected.id desc
        ))[1] as nickname,
        (array_agg(
            selected.avatar_url
            order by
                (selected.avatar_url is not null) desc,
                selected.submitted_at desc,
                selected.id desc
        ))[1] as avatar_url,
        sum(selected.league_points)::integer as total_league_points,
        max(selected.league_points)::integer as best_game_points,
        count(*)::integer as contributing_games,
        min(selected.submitted_at) as first_contribution_at
      from selected
     group by selected.guest_id;
$$;

create or replace function public.get_guest_weekly_leaderboard(
    p_guest_id uuid
)
returns table (
    player_key uuid,
    nickname text,
    avatar_url text,
    league_points integer,
    best_game_points integer,
    contributing_games integer,
    first_contribution_at timestamptz,
    rank bigint,
    is_current boolean,
    week_start date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_week_start date := date_trunc(
        'week',
        timezone('Europe/Istanbul', v_now)
    )::date;
    v_venue_id uuid;
begin
    select vt.venue_id
      into v_venue_id
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

    if v_venue_id is null then
        return;
    end if;

    return query
    with ranked as (
        select
            league.*,
            row_number() over (
                order by
                    league.total_league_points desc,
                    league.best_game_points desc,
                    league.first_contribution_at asc,
                    league.guest_id asc
            )::bigint as league_rank
          from public.calculate_weekly_league(
              v_venue_id,
              v_week_start
          ) as league
    )
    select
        ranked.player_key,
        ranked.nickname,
        ranked.avatar_url,
        ranked.total_league_points,
        ranked.best_game_points,
        ranked.contributing_games,
        ranked.first_contribution_at,
        ranked.league_rank,
        ranked.guest_id = p_guest_id,
        v_week_start
      from ranked
     where ranked.league_rank <= 10
        or ranked.guest_id = p_guest_id
     order by ranked.league_rank;
end;
$$;

create or replace function public.get_weekly_league_winner(
    p_venue_id uuid,
    p_week_start date default null
)
returns table (
    venue_id uuid,
    week_start date,
    winner_guest_id uuid,
    final_league_points integer,
    best_game_points integer,
    first_contribution_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        p_venue_id,
        coalesce(
            p_week_start,
            date_trunc(
                'week',
                timezone('Europe/Istanbul', now())
            )::date
        ),
        league.guest_id,
        league.total_league_points,
        league.best_game_points,
        league.first_contribution_at
      from public.calculate_weekly_league(
          p_venue_id,
          coalesce(
              p_week_start,
              date_trunc(
                  'week',
                  timezone('Europe/Istanbul', now())
              )::date
          )
      ) as league
     order by
        league.total_league_points desc,
        league.best_game_points desc,
        league.first_contribution_at asc,
        league.guest_id asc
     limit 1;
$$;

revoke all on function public.seed_venue_league_settings() from public, anon, authenticated;
revoke all on function public.submit_game_result(uuid, text, integer, text, text, text, uuid)
from public, anon, authenticated;
revoke all on function public.get_guest_game_leaderboard(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.calculate_weekly_league(uuid, date)
from public, anon, authenticated;
revoke all on function public.get_guest_weekly_leaderboard(uuid)
from public, anon, authenticated;
revoke all on function public.get_weekly_league_winner(uuid, date)
from public, anon, authenticated;

grant execute on function public.submit_game_result(uuid, text, integer, text, text, text, uuid)
to service_role;
grant execute on function public.get_guest_game_leaderboard(uuid, text, text)
to service_role;
grant execute on function public.calculate_weekly_league(uuid, date)
to service_role;
grant execute on function public.get_guest_weekly_leaderboard(uuid)
to service_role;
grant execute on function public.get_weekly_league_winner(uuid, date)
to service_role;
