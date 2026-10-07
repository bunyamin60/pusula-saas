-- Make Quiz server-authoritative and make the visible weekly overall league
-- use the exact same trusted/reward-eligible population as the future stamp
-- winner. Block Blast remains a client-reported game-only leaderboard.

update public.leaderboard_game_configs
   set eligible_for_league = true,
       trust_level = 'server_authoritative',
       reward_eligible = true
 where game_key = 'quiz';

update public.leaderboard_game_configs
   set eligible_for_league = false,
       trust_level = 'client_reported',
       reward_eligible = false
 where game_key = 'blockblast';

-- Historical browser-reported results must never be upgraded retroactively.
update public.game_results
   set eligible_for_league = false
 where game_key = 'blockblast';

create table public.quiz_attempts (
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
    category text not null,
    question_ids text[] not null,
    answer_key smallint[] not null,
    submitted_answers smallint[] not null default array[]::smallint[],
    current_index integer not null default 0,
    correct_count integer not null default 0,
    raw_score integer not null default 0,
    nickname text not null,
    avatar_url text,
    status text not null default 'active'
        check (status in ('active', 'completed', 'expired')),
    started_at timestamptz not null default now(),
    expires_at timestamptz not null,
    completed_at timestamptz,
    result_id uuid unique
        references public.game_results(id)
        on delete set null,
    check (category in ('cafe', 'turkey', 'general', 'sports')),
    check (cardinality(question_ids) between 1 and 20),
    check (cardinality(question_ids) = cardinality(answer_key)),
    check (current_index between 0 and cardinality(question_ids)),
    check (correct_count between 0 and current_index),
    check (raw_score = correct_count * 100),
    check (char_length(nickname) between 1 and 64),
    check (avatar_url is null or char_length(avatar_url) <= 160),
    check (expires_at > started_at)
);

create index quiz_attempts_guest_recent_idx
    on public.quiz_attempts (guest_id, started_at desc);

create unique index quiz_attempts_one_active_per_guest
    on public.quiz_attempts (guest_id)
    where status = 'active';

alter table public.quiz_attempts enable row level security;
revoke all on table public.quiz_attempts from public, anon, authenticated;
grant select, insert, update on table public.quiz_attempts to service_role;

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
    v_attempt_id uuid;
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
        return jsonb_build_object(
            'ok', false,
            'reason', 'invalid_request'
        );
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
        return jsonb_build_object(
            'ok', false,
            'reason', 'quiz_unavailable'
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
            'ok', false,
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
            'ok', false,
            'reason', 'venue_verification_required'
        );
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_guest_id::text || ':quiz-attempt', 0)
    );

    update public.quiz_attempts as qa
       set status = 'expired'
     where qa.guest_id = p_guest_id
       and qa.status = 'active';

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
        expires_at
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
        v_now + interval '15 minutes'
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
        'ok', true,
        'attempt_id', v_attempt_id,
        'category', v_category,
        'question_count', cardinality(p_question_ids),
        'expires_at', v_now + interval '15 minutes'
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
    v_correct boolean;
    v_points integer;
    v_next_index integer;
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
        v_correct := p_question_id = v_attempt.question_ids[v_attempt.current_index]
            and p_answer_index = v_correct_answer;
        return jsonb_build_object(
            'ok', true,
            'duplicate', true,
            'correct', v_correct,
            'correct_answer', v_correct_answer,
            'points_awarded', 0,
            'completed', true,
            'raw_score', v_attempt.raw_score,
            'result_id', v_attempt.result_id,
            'category', v_attempt.category
        );
    end if;

    if v_attempt.status <> 'active' or v_attempt.expires_at <= v_now then
        update public.quiz_attempts
           set status = 'expired'
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

    v_next_index := v_attempt.current_index + 1;
    v_expected_question_id := v_attempt.question_ids[v_next_index];
    v_correct_answer := v_attempt.answer_key[v_next_index];

    if v_expected_question_id is null
       or v_expected_question_id <> trim(p_question_id) then
        return jsonb_build_object('ok', false, 'reason', 'invalid_question');
    end if;

    v_correct := p_answer_index = v_correct_answer;
    v_points := case when v_correct then 100 else 0 end;

    update public.quiz_attempts as qa
       set submitted_answers = array_append(
               qa.submitted_answers,
               p_answer_index::smallint
           ),
           current_index = v_next_index,
           correct_count = qa.correct_count + case when v_correct then 1 else 0 end,
           raw_score = qa.raw_score + v_points
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
            false,
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
            'correct_answer', v_correct_answer,
            'points_awarded', v_points,
            'raw_score', v_attempt.raw_score,
            'completed', true,
            'result_id', v_result_id,
            'category', v_attempt.category
        );
    end if;

    return jsonb_build_object(
        'ok', true,
        'duplicate', false,
        'correct', v_correct,
        'correct_answer', v_correct_answer,
        'points_awarded', v_points,
        'raw_score', v_attempt.raw_score,
        'completed', false,
        'category', v_attempt.category
    );
end;
$$;

-- The public weekly league and both winner RPC names now share the same
-- trusted/reward-eligible calculation. There is no separate visible league.
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
    select *
      from public.calculate_reward_eligible_weekly_league(
          p_venue_id,
          p_week_start
      );
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
    select *
      from public.get_reward_eligible_weekly_league_winner(
          p_venue_id,
          p_week_start
      );
$$;

revoke all on function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) from public, anon, authenticated;
revoke all on function public.submit_quiz_answer(uuid, uuid, text, integer)
from public, anon, authenticated;

grant execute on function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) to service_role;
grant execute on function public.submit_quiz_answer(uuid, uuid, text, integer)
to service_role;
