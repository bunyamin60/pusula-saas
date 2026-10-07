-- Do not resume an active Quiz attempt after the guest's physical table
-- session has rolled. The old attempt stays counted for daily anti-farming,
-- but is expired so the current table session can start a usable attempt.

alter function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) rename to start_quiz_attempt_fairness_internal;

revoke all on function public.start_quiz_attempt_fairness_internal(
    uuid, text, text[], smallint[], text, text
) from public, anon, authenticated, service_role;

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
    v_result jsonb;
    v_attempt_id uuid;
    v_bound_table_session_id uuid;
    v_current_table_session_id uuid;
begin
    v_result := public.start_quiz_attempt_fairness_internal(
        p_guest_id,
        p_category,
        p_question_ids,
        p_answer_key,
        p_nickname,
        p_avatar_url
    );

    if v_result->>'ok' <> 'true'
       or v_result->>'resumed' <> 'true' then
        return v_result;
    end if;

    v_attempt_id := (v_result->>'attempt_id')::uuid;

    select qa.guest_table_session_id
      into v_bound_table_session_id
      from public.quiz_attempts as qa
     where qa.id = v_attempt_id
       and qa.guest_id = p_guest_id
       and qa.status = 'active'
     for update;

    select gts.id
      into v_current_table_session_id
      from public.guest_table_sessions as gts
      join public.venue_tables as vt
        on vt.id = gts.venue_table_id
       and vt.is_active = true
      join public.venues as v
        on v.id = vt.venue_id
       and v.is_active = true
     where gts.guest_id = p_guest_id
       and gts.status = 'active'
       and gts.last_seen_at >= now() - interval '2 minutes'
     order by gts.last_seen_at desc
     limit 1;

    if v_bound_table_session_id = v_current_table_session_id then
        return v_result;
    end if;

    update public.quiz_attempts
       set status = 'expired',
           question_started_at = null,
           question_deadline_at = null
     where id = v_attempt_id
       and guest_id = p_guest_id
       and status = 'active';

    return public.start_quiz_attempt_fairness_internal(
        p_guest_id,
        p_category,
        p_question_ids,
        p_answer_key,
        p_nickname,
        p_avatar_url
    );
end;
$$;

revoke all on function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) from public, anon, authenticated;
grant execute on function public.start_quiz_attempt(
    uuid, text, text[], smallint[], text, text
) to service_role;
