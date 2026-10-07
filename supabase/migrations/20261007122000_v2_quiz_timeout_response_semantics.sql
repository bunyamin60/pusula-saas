-- Canonicalize the public timeout response without changing the established
-- deadline/scoring implementation. The internal function remains responsible
-- for the DB-clock deadline + grace decision. Answer index -1 is the server
-- API's explicit "no answer selected" command and is therefore also a timeout.

alter function public.submit_quiz_answer(uuid, uuid, text, integer)
rename to submit_quiz_answer_deadline_internal;

revoke all on function public.submit_quiz_answer_deadline_internal(
    uuid, uuid, text, integer
) from public, anon, authenticated, service_role;

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
    v_result jsonb;
    v_stored_answer integer;
    v_timed_out boolean;
begin
    v_result := public.submit_quiz_answer_deadline_internal(
        p_guest_id,
        p_attempt_id,
        p_question_id,
        p_answer_index
    );

    if v_result->>'ok' <> 'true' then
        return v_result;
    end if;

    if coalesce((v_result->>'duplicate')::boolean, false) then
        select qa.submitted_answers[qa.current_index]
          into v_stored_answer
          from public.quiz_attempts as qa
         where qa.id = p_attempt_id
           and qa.guest_id = p_guest_id;

        v_timed_out := coalesce(
            (v_result->>'timed_out')::boolean,
            false
        ) or coalesce(v_stored_answer = -1, false);
    else
        v_timed_out := coalesce(
            (v_result->>'timed_out')::boolean,
            false
        ) or p_answer_index = -1;
    end if;

    if v_timed_out then
        return v_result || jsonb_build_object(
            'timed_out', true,
            'correct', false,
            'points_awarded', 0
        );
    end if;

    return v_result || jsonb_build_object('timed_out', false);
end;
$$;

revoke all on function public.submit_quiz_answer(uuid, uuid, text, integer)
from public, anon, authenticated;
grant execute on function public.submit_quiz_answer(uuid, uuid, text, integer)
to service_role;
