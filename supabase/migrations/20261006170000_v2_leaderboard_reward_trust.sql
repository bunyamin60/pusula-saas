-- Separate entertainment/display scores from results trusted enough to create
-- a real-world reward. Existing Quiz and Block Blast submissions are reported
-- by the browser, so they remain visible but cannot produce a reward winner.

alter table public.leaderboard_game_configs
    add column trust_level text not null default 'client_reported'
        check (trust_level in ('client_reported', 'server_authoritative')),
    add column reward_eligible boolean not null default false,
    add constraint leaderboard_game_configs_reward_trust_check
        check (
            reward_eligible = false
            or (
                eligible_for_league = true
                and trust_level = 'server_authoritative'
            )
        );

comment on column public.leaderboard_game_configs.is_active is
    'Enables game-specific score submission and leaderboard display.';
comment on column public.leaderboard_game_configs.eligible_for_league is
    'Allows the game to contribute to the display weekly overall league.';
comment on column public.leaderboard_game_configs.trust_level is
    'Describes whether accepted scores are browser-reported or server-authoritative.';
comment on column public.leaderboard_game_configs.reward_eligible is
    'Allows trusted results to contribute to a future real-world reward winner.';

update public.leaderboard_game_configs
   set trust_level = 'client_reported',
       reward_eligible = false
 where game_key in ('quiz', 'blockblast');

alter table public.game_results
    add column trust_level text not null default 'client_reported'
        check (trust_level in ('client_reported', 'server_authoritative')),
    add column reward_eligible boolean not null default false,
    add constraint game_results_reward_trust_check
        check (
            reward_eligible = false
            or (
                eligible_for_league = true
                and trust_level = 'server_authoritative'
            )
        );

update public.game_results as gr
   set trust_level = lgc.trust_level,
       reward_eligible = lgc.reward_eligible
  from public.leaderboard_game_configs as lgc
 where lgc.game_key = gr.game_key;

-- Snapshot all eligibility decisions from server-owned game configuration.
-- A caller cannot elevate an inserted result by supplying trusted flags.
create or replace function public.apply_game_result_trust_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_config public.leaderboard_game_configs;
begin
    select *
      into v_config
      from public.leaderboard_game_configs as lgc
     where lgc.game_key = new.game_key;

    if v_config.game_key is null then
        raise exception 'Unknown leaderboard game: %', new.game_key;
    end if;

    new.eligible_for_league := v_config.eligible_for_league;
    new.trust_level := v_config.trust_level;
    new.reward_eligible := v_config.reward_eligible;
    return new;
end;
$$;

create trigger game_results_apply_trust_config
before insert on public.game_results
for each row
execute function public.apply_game_result_trust_config();

-- Preserve the existing client-score implementation behind a private
-- function. The public server RPC below refuses server-authoritative games so
-- the generic browser submission endpoint can never mint a trusted result.
alter function public.submit_game_result(uuid, text, integer, text, text, text, uuid)
rename to submit_client_game_result_internal;

revoke all on function public.submit_client_game_result_internal(
    uuid, text, integer, text, text, text, uuid
) from public, anon, authenticated, service_role;

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
    v_game_key text := lower(trim(coalesce(p_game_key, '')));
    v_config public.leaderboard_game_configs;
    v_result jsonb;
begin
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

    if v_config.trust_level <> 'client_reported' then
        return jsonb_build_object(
            'ok', false,
            'accepted', false,
            'reason', 'server_authoritative_submission_required'
        );
    end if;

    v_result := public.submit_client_game_result_internal(
        p_guest_id,
        v_game_key,
        p_raw_score,
        p_category,
        p_nickname,
        p_avatar_url,
        p_submission_key
    );

    return v_result || jsonb_build_object(
        'trust_level', v_config.trust_level,
        'reward_eligible', v_config.reward_eligible
    );
end;
$$;

revoke all on function public.submit_game_result(
    uuid, text, integer, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.submit_game_result(
    uuid, text, integer, text, text, text, uuid
) to service_role;

-- Reward standings deliberately repeat the display calculation over the much
-- smaller trusted subset. Category is not part of the grouping key: every Quiz
-- category remains one game contribution for best-game-limit purposes.
create or replace function public.calculate_reward_eligible_weekly_league(
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
           and gr.reward_eligible = true
           and gr.trust_level = 'server_authoritative'
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

create or replace function public.get_reward_eligible_weekly_league_winner(
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
      from public.calculate_reward_eligible_weekly_league(
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

revoke all on function public.apply_game_result_trust_config()
from public, anon, authenticated;
revoke all on function public.calculate_reward_eligible_weekly_league(uuid, date)
from public, anon, authenticated;
revoke all on function public.get_reward_eligible_weekly_league_winner(uuid, date)
from public, anon, authenticated;

grant execute on function public.calculate_reward_eligible_weekly_league(uuid, date)
to service_role;
grant execute on function public.get_reward_eligible_weekly_league_winner(uuid, date)
to service_role;
