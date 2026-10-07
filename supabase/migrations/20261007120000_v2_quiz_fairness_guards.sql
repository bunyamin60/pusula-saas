-- Close the remaining Quiz fairness gaps before trusted results can create
-- real-world rewards. Timing, daily eligibility and active-attempt ownership
-- are all decided by the database clock and server-owned configuration.

create table public.venue_quiz_settings (
    venue_id uuid primary key
        references public.venues(id)
        on delete cascade,
    question_duration_ms integer not null default 10000
        check (question_duration_ms between 3000 and 60000),
    answer_grace_ms integer not null default 750
        check (answer_grace_ms between 0 and 5000),
    attempt_ttl_minutes integer not null default 15
        check (attempt_ttl_minutes between 5 and 60),
    daily_eligible_attempt_limit integer not null default 3
        check (daily_eligible_attempt_limit between 0 and 20),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.venue_quiz_settings is
    'Server-owned per-venue Quiz timing and daily league eligibility settings.';

insert into public.venue_quiz_settings (venue_id)
select v.id
  from public.venues as v
on conflict (venue_id) do nothing;

create or replace function public.seed_venue_quiz_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.venue_quiz_settings (venue_id)
    values (new.id)
    on conflict (venue_id) do nothing;
    return new;
end;
$$;

create trigger venues_seed_quiz_settings
after insert on public.venues
for each row
execute function public.seed_venue_quiz_settings();

alter table public.venue_quiz_settings enable row level security;
revoke all on table public.venue_quiz_settings
from public, anon, authenticated;
grant select, insert, update on table public.venue_quiz_settings
to service_role;
revoke all on function public.seed_venue_quiz_settings()
from public, anon, authenticated;

alter table public.quiz_attempts
    add column eligibility_day date,
    add column league_eligible_at_start boolean not null default false,
    add column question_duration_ms integer not null default 10000,
    add column answer_grace_ms integer not null default 750,
    add column question_started_at timestamptz,
    add column question_deadline_at timestamptz,
    add column total_response_time_ms bigint not null default 0;

update public.quiz_attempts
   set eligibility_day = timezone('Europe/Istanbul', started_at)::date;

alter table public.quiz_attempts
    alter column eligibility_day set not null,
    add constraint quiz_attempts_question_duration_check
        check (question_duration_ms between 3000 and 60000),
    add constraint quiz_attempts_answer_grace_check
        check (answer_grace_ms between 0 and 5000),
    add constraint quiz_attempts_question_clock_check
        check (
            (question_started_at is null and question_deadline_at is null)
            or (
                question_started_at is not null
                and question_deadline_at > question_started_at
            )
        ),
    add constraint quiz_attempts_response_time_check
        check (total_response_time_ms >= 0);

drop index public.quiz_attempts_one_active_per_guest;
create unique index quiz_attempts_one_active_per_guest_venue
    on public.quiz_attempts (guest_id, venue_id)
    where status = 'active';

create index quiz_attempts_daily_eligibility_idx
    on public.quiz_attempts (
        guest_id,
        venue_id,
        eligibility_day,
        league_eligible_at_start
    );

alter table public.game_results
    add column response_time_ms bigint
        check (response_time_ms is null or response_time_ms >= 0);

-- Results created before server timing existed cannot participate in a future
-- real-world reward. They remain available in the game-specific history.
update public.game_results
   set eligible_for_league = false,
       reward_eligible = false
 where game_key = 'quiz'
   and response_time_ms is null;

drop index public.game_results_game_week_rank_idx;
create index game_results_game_week_rank_idx
    on public.game_results (
        venue_id,
        week_start,
        game_key,
        raw_score desc,
        response_time_ms asc nulls last,
        submitted_at asc
    );

-- The trigger may lower eligibility selected by the trusted server path, but
-- can never raise it above the server-owned game configuration.
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

    new.eligible_for_league :=
        v_config.eligible_for_league
        and coalesce(new.eligible_for_league, false);
    new.trust_level := v_config.trust_level;
    new.reward_eligible :=
        v_config.reward_eligible
        and new.eligible_for_league
        and coalesce(new.reward_eligible, false);
    return new;
end;
$$;

create or replace function public.start_quiz_attempt(
    p_guest_id uuid,
    p_category text,
    p_question_ids text[],
    p_answer_key smallint[],
    p_nickname text default null,
    p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_category text := lower(trim(coalesce(p_category, '')));
    v_table_session_id uuid;
    v_venue_id uuid;
    v_attempt public.quiz_attempts;
    v_settings public.venue_quiz_settings;
    v_eligibility_day date := timezone('Europe/Istanbul', v_now)::date;
    v_eligible_attempt_count integer;
    v_league_eligible boolean;
    v_nickname text := coalesce(
        nullif(left(trim(coalesce(p_nickname, '')), 64), ''),
        'Misafir'
    );
    v_avatar_url text := nullif(left(trim(coalesce(p_avatar_url, '')), 160), '');
begin
    if p_guest_id is null
       or v_category not in ('cafe', 'turkey', 'general', 'sports')
       or p_question_ids is null
       or p_answer_key is null
       or cardinality(p_question_ids) not between 1 and 20
       or cardinality(p_question_ids) <> cardinality(p_answer_key)
       or exists (
           select 1
             from unnest(p_answer_key) as answer_value
            where answer_value < 0 or answer_value > 9
       ) then
        return jsonb_build_object('ok', false, 'reason', 'invalid_request');
    end if;

    if not exists (
        select 1
          from public.leaderboard_game_configs as lgc
         where lgc.game_key = 'quiz'
           and lgc.is_active = true
           and lgc.eligible_for_league = true
           and lgc.trust_level = 'server_authoritative'
           and lgc.reward_eligible = true
           and v_category = any(lgc.allowed_categories)
    ) then
        return jsonb_build_object('ok', false, 'reason', 'quiz_unavailable');
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
        return jsonb_build_object('ok', false, 'reason', 'active_session_required');
    end if;

    if not exists (
        select 1
          from public.guest_venue_verifications as gvv
         where gvv.guest_id = p_guest_id
           and gvv.venue_id = v_venue_id
           and gvv.expires_at > v_now
    ) then
        return jsonb_build_object(
            'ok', false,
            'reason', 'venue_verification_required'
        );
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_guest_id::text || ':' || v_venue_id::text || ':quiz-attempt',
            0
        )
    );

    update public.quiz_attempts as qa
       set status = 'expired',
           question_started_at = null,
           question_deadline_at = null
     where qa.guest_id = p_guest_id
       and qa.status = 'active'
       and qa.expires_at <= v_now;

    select *
      into v_attempt
      from public.quiz_attempts as qa
     where qa.guest_id = p_guest_id
       and qa.venue_id = v_venue_id
       and qa.status = 'active'
     order by qa.started_at desc
     limit 1
     for update;

    -- Concurrent/repeated starts resume the one server-owned attempt. This
    -- keeps the unique active-attempt invariant and does not consume a new
    -- daily eligibility slot.
    if v_attempt.id is not null then
        return jsonb_build_object(
            'ok', true,
            'resumed', true,
            'attempt_id', v_attempt.id,
            'category', v_attempt.category,
            'question_ids', v_attempt.question_ids,
            'question_count', cardinality(v_attempt.question_ids),
            'current_index', v_attempt.current_index,
            'raw_score', v_attempt.raw_score,
            'question_duration_ms', v_attempt.question_duration_ms,
            'question_started_at', v_attempt.question_started_at,
            'question_deadline_at', v_attempt.question_deadline_at,
            'expires_at', v_attempt.expires_at,
            'eligible_for_league', v_attempt.league_eligible_at_start
        );
    end if;

    insert into public.venue_quiz_settings (venue_id)
    values (v_venue_id)
    on conflict (venue_id) do nothing;

    select *
      into v_settings
      from public.venue_quiz_settings as vqs
     where vqs.venue_id = v_venue_id
     for update;

    select count(*)::integer
      into v_eligible_attempt_count
      from public.quiz_attempts as qa
     where qa.guest_id = p_guest_id
       and qa.venue_id = v_venue_id
       and qa.eligibility_day = v_eligibility_day
       and qa.league_eligible_at_start = true;

    v_league_eligible :=
        v_eligible_attempt_count < v_settings.daily_eligible_attempt_limit;

    insert into public.quiz_attempts (
        venue_id,
        guest_id,
        guest_table_session_id,
        category,
        question_ids,
        answer_key,
        nickname,
        avatar_url,
        started_at,
        expires_at,
        eligibility_day,
        league_eligible_at_start,
        question_duration_ms,
        answer_grace_ms
    )
    values (
        v_venue_id,
        p_guest_id,
        v_table_session_id,
        v_category,
        p_question_ids,
        p_answer_key,
        v_nickname,
        v_avatar_url,
        v_now,
        v_now + make_interval(mins => v_settings.attempt_ttl_minutes),
        v_eligibility_day,
        v_league_eligible,
        v_settings.question_duration_ms,
        v_settings.answer_grace_ms
    )
    returning * into v_attempt;

    return jsonb_build_object(
        'ok', true,
        'resumed', false,
        'attempt_id', v_attempt.id,
        'category', v_attempt.category,
        'question_ids', v_attempt.question_ids,
        'question_count', cardinality(v_attempt.question_ids),
        'current_index', 0,
        'raw_score', 0,
        'question_duration_ms', v_attempt.question_duration_ms,
        'question_started_at', null,
        'question_deadline_at', null,
        'expires_at', v_attempt.expires_at,
        'eligible_for_league', v_attempt.league_eligible_at_start
    );
end;
$$;

create or replace function public.start_quiz_question(
    p_guest_id uuid,
    p_attempt_id uuid,
    p_question_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_attempt public.quiz_attempts;
    v_expected_question_id text;
begin
    if p_guest_id is null
       or p_attempt_id is null
       or nullif(trim(coalesce(p_question_id, '')), '') is null then
        return jsonb_build_object('ok', false, 'reason', 'invalid_request');
    end if;

    select *
      into v_attempt
      from public.quiz_attempts as qa
     where qa.id = p_attempt_id
       and qa.guest_id = p_guest_id
     for update;

    if v_attempt.id is null then
        return jsonb_build_object('ok', false, 'reason', 'attempt_not_found');
    end if;

    if v_attempt.status <> 'active' or v_attempt.expires_at <= v_now then
        update public.quiz_attempts
           set status = 'expired',
               question_started_at = null,
               question_deadline_at = null
         where id = v_attempt.id
           and status = 'active';
        return jsonb_build_object('ok', false, 'reason', 'attempt_expired');
    end if;

    if not exists (
        select 1
          from public.guest_table_sessions as gts
          join public.venue_tables as vt
            on vt.id = gts.venue_table_id
           and vt.is_active = true
          join public.venues as v
            on v.id = vt.venue_id
           and v.is_active = true
         where gts.id = v_attempt.guest_table_session_id
           and gts.guest_id = p_guest_id
           and gts.status = 'active'
           and gts.last_seen_at >= v_now - interval '2 minutes'
           and vt.venue_id = v_attempt.venue_id
    ) then
        return jsonb_build_object('ok', false, 'reason', 'active_session_required');
    end if;

    if not exists (
        select 1
          from public.guest_venue_verifications as gvv
         where gvv.guest_id = p_guest_id
           and gvv.venue_id = v_attempt.venue_id
           and gvv.expires_at > v_now
    ) then
        return jsonb_build_object(
            'ok', false,
            'reason', 'venue_verification_required'
        );
    end if;

    v_expected_question_id := v_attempt.question_ids[v_attempt.current_index + 1];
    if v_expected_question_id is null
       or v_expected_question_id <> trim(p_question_id) then
        return jsonb_build_object('ok', false, 'reason', 'invalid_question');
    end if;

    if v_attempt.question_started_at is null then
        update public.quiz_attempts
           set question_started_at = v_now,
               question_deadline_at = v_now
                   + v_attempt.question_duration_ms * interval '1 millisecond'
         where id = v_attempt.id
        returning * into v_attempt;
    end if;

    return jsonb_build_object(
        'ok', true,
        'question_id', v_expected_question_id,
        'current_index', v_attempt.current_index,
        'question_duration_ms', v_attempt.question_duration_ms,
        'question_started_at', v_attempt.question_started_at,
        'question_deadline_at', v_attempt.question_deadline_at
    );
end;
$$;

create or replace function public.submit_quiz_answer(
    p_guest_id uuid,
    p_attempt_id uuid,
    p_question_id text,
    p_answer_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_attempt public.quiz_attempts;
    v_expected_question_id text;
    v_correct_answer integer;
    v_effective_answer integer;
    v_correct boolean;
    v_timed_out boolean;
    v_points integer;
    v_next_index integer;
    v_elapsed_ms bigint;
    v_response_time_ms bigint;
    v_result_id uuid;
    v_week_start date := date_trunc(
        'week',
        timezone('Europe/Istanbul', v_now)
    )::date;
begin
    if p_guest_id is null
       or p_attempt_id is null
       or nullif(trim(coalesce(p_question_id, '')), '') is null
       or p_answer_index is null
       or p_answer_index < -1
       or p_answer_index > 9 then
        return jsonb_build_object('ok', false, 'reason', 'invalid_request');
    end if;

    select *
      into v_attempt
      from public.quiz_attempts as qa
     where qa.id = p_attempt_id
       and qa.guest_id = p_guest_id
     for update;

    if v_attempt.id is null then
        return jsonb_build_object('ok', false, 'reason', 'attempt_not_found');
    end if;

    if v_attempt.status = 'completed' then
        v_correct_answer := v_attempt.answer_key[v_attempt.current_index];
        return jsonb_build_object(
            'ok', true,
            'duplicate', true,
            'correct', false,
            'timed_out', false,
            'correct_answer', v_correct_answer,
            'points_awarded', 0,
            'completed', true,
            'raw_score', v_attempt.raw_score,
            'response_time_ms', v_attempt.total_response_time_ms,
            'eligible_for_league', v_attempt.league_eligible_at_start,
            'result_id', v_attempt.result_id,
            'category', v_attempt.category
        );
    end if;

    if v_attempt.status <> 'active' or v_attempt.expires_at <= v_now then
        update public.quiz_attempts
           set status = 'expired',
               question_started_at = null,
               question_deadline_at = null
         where id = v_attempt.id
           and status = 'active';
        return jsonb_build_object('ok', false, 'reason', 'attempt_expired');
    end if;

    -- Every answer, including the final answer, re-establishes the exact guest,
    -- table session, venue and verification trust boundary.
    if not exists (
        select 1
          from public.guest_table_sessions as gts
          join public.venue_tables as vt
            on vt.id = gts.venue_table_id
           and vt.is_active = true
          join public.venues as v
            on v.id = vt.venue_id
           and v.is_active = true
         where gts.id = v_attempt.guest_table_session_id
           and gts.guest_id = p_guest_id
           and gts.status = 'active'
           and gts.last_seen_at >= v_now - interval '2 minutes'
           and vt.venue_id = v_attempt.venue_id
    ) then
        return jsonb_build_object('ok', false, 'reason', 'active_session_required');
    end if;

    if not exists (
        select 1
          from public.guest_venue_verifications as gvv
         where gvv.guest_id = p_guest_id
           and gvv.venue_id = v_attempt.venue_id
           and gvv.expires_at > v_now
    ) then
        return jsonb_build_object(
            'ok', false,
            'reason', 'venue_verification_required'
        );
    end if;

    v_next_index := v_attempt.current_index + 1;
    v_expected_question_id := v_attempt.question_ids[v_next_index];
    v_correct_answer := v_attempt.answer_key[v_next_index];

    if v_expected_question_id is null
       or v_expected_question_id <> trim(p_question_id) then
        return jsonb_build_object('ok', false, 'reason', 'invalid_question');
    end if;

    if v_attempt.question_started_at is null
       or v_attempt.question_deadline_at is null then
        return jsonb_build_object('ok', false, 'reason', 'question_not_started');
    end if;

    v_timed_out := v_now > v_attempt.question_deadline_at
        + v_attempt.answer_grace_ms * interval '1 millisecond';
    v_effective_answer := case when v_timed_out then -1 else p_answer_index end;
    v_correct := not v_timed_out and v_effective_answer = v_correct_answer;
    v_points := case when v_correct then 100 else 0 end;
    v_elapsed_ms := greatest(
        0,
        floor(
            extract(epoch from (v_now - v_attempt.question_started_at)) * 1000
        )::bigint
    );
    v_response_time_ms := least(
        v_elapsed_ms,
        (v_attempt.question_duration_ms + v_attempt.answer_grace_ms)::bigint
    );

    update public.quiz_attempts as qa
       set submitted_answers = array_append(
               qa.submitted_answers,
               v_effective_answer::smallint
           ),
           current_index = v_next_index,
           correct_count = qa.correct_count + case when v_correct then 1 else 0 end,
           raw_score = qa.raw_score + v_points,
           total_response_time_ms = qa.total_response_time_ms + v_response_time_ms,
           question_started_at = null,
           question_deadline_at = null
     where qa.id = v_attempt.id
    returning * into v_attempt;

    if v_next_index = cardinality(v_attempt.question_ids) then
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
            trust_level,
            reward_eligible,
            response_time_ms,
            submitted_at
        )
        values (
            v_attempt.venue_id,
            v_attempt.guest_id,
            v_attempt.guest_table_session_id,
            'quiz',
            v_attempt.category,
            v_attempt.raw_score,
            v_attempt.nickname,
            v_attempt.avatar_url,
            v_attempt.id,
            v_week_start,
            v_attempt.league_eligible_at_start,
            'server_authoritative',
            v_attempt.league_eligible_at_start,
            v_attempt.total_response_time_ms,
            v_now
        )
        on conflict (guest_id, submission_key) do nothing
        returning id into v_result_id;

        if v_result_id is null then
            select gr.id
              into v_result_id
              from public.game_results as gr
             where gr.guest_id = v_attempt.guest_id
               and gr.submission_key = v_attempt.id;
        end if;

        update public.quiz_attempts
           set status = 'completed',
               completed_at = v_now,
               result_id = v_result_id
         where id = v_attempt.id;

        return jsonb_build_object(
            'ok', true,
            'duplicate', false,
            'correct', v_correct,
            'timed_out', v_timed_out,
            'correct_answer', v_correct_answer,
            'points_awarded', v_points,
            'raw_score', v_attempt.raw_score,
            'response_time_ms', v_attempt.total_response_time_ms,
            'eligible_for_league', v_attempt.league_eligible_at_start,
            'completed', true,
            'result_id', v_result_id,
            'category', v_attempt.category
        );
    end if;

    return jsonb_build_object(
        'ok', true,
        'duplicate', false,
        'correct', v_correct,
        'timed_out', v_timed_out,
        'correct_answer', v_correct_answer,
        'points_awarded', v_points,
        'raw_score', v_attempt.raw_score,
        'response_time_ms', v_attempt.total_response_time_ms,
        'eligible_for_league', v_attempt.league_eligible_at_start,
        'completed', false,
        'category', v_attempt.category
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
            scoped.response_time_ms asc nulls last,
            scoped.submitted_at asc,
            scoped.id asc
    ),
    ranked as (
        select
            best.*,
            row_number() over (
                order by
                    best.raw_score desc,
                    best.response_time_ms asc nulls last,
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
            gr.response_time_ms,
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
            gr.response_time_ms asc nulls last,
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
                    bgr.response_time_ms asc nulls last,
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
                    sg.response_time_ms asc nulls last,
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

revoke all on function public.start_quiz_question(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.start_quiz_question(uuid, uuid, text)
to service_role;

-- Reassert least privilege for replaced functions.
revoke all on function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) from public, anon, authenticated;
revoke all on function public.submit_quiz_answer(uuid, uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.get_guest_game_leaderboard(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.calculate_reward_eligible_weekly_league(uuid, date)
from public, anon, authenticated;

grant execute on function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) to service_role;
grant execute on function public.submit_quiz_answer(uuid, uuid, text, integer)
to service_role;
grant execute on function public.get_guest_game_leaderboard(uuid, text, text)
to service_role;
grant execute on function public.calculate_reward_eligible_weekly_league(uuid, date)
to service_role;
