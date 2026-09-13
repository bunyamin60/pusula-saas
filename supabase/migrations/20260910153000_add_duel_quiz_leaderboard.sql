alter table public.tenant_settings
  alter column enabled_games
  set default '{"trivia": true, "emoji": true, "swipe": true, "number": true, "quiz": true}'::jsonb;

update public.tenant_settings
set enabled_games = enabled_games || '{"quiz": true}'::jsonb
where not (enabled_games ? 'quiz');

create table if not exists public.duel_quiz_scores (
  tenant_id text not null,
  client_id text not null,
  nickname text not null check (char_length(nickname) between 1 and 64),
  avatar text not null check (char_length(avatar) between 1 and 16),
  score integer not null check (score between 0 and 1600),
  completed_at timestamptz not null default now(),
  primary key (tenant_id, client_id)
);

create index if not exists duel_quiz_scores_ranking_idx
  on public.duel_quiz_scores (tenant_id, score desc, completed_at asc);

alter table public.duel_quiz_scores enable row level security;

drop policy if exists "duel quiz scores are publicly readable"
  on public.duel_quiz_scores;

create policy "duel quiz scores are publicly readable"
  on public.duel_quiz_scores
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.duel_quiz_scores
  from anon, authenticated;
grant select on public.duel_quiz_scores to anon, authenticated;

create or replace function public.submit_duel_quiz_score(
  p_tenant_id text,
  p_client_id text,
  p_nickname text,
  p_avatar text,
  p_score integer
)
returns table (
  tenant_id text,
  client_id text,
  nickname text,
  avatar text,
  score integer,
  completed_at timestamptz,
  rank bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(trim(p_client_id)) not between 8 and 128
    or char_length(trim(p_nickname)) not between 1 and 64
    or char_length(trim(p_avatar)) not between 1 and 16
    or p_score not between 0 and 1600 then
    raise exception 'invalid_quiz_score';
  end if;

  insert into public.duel_quiz_scores as current_score (
    tenant_id,
    client_id,
    nickname,
    avatar,
    score,
    completed_at
  )
  values (
    trim(p_tenant_id),
    trim(p_client_id),
    trim(p_nickname),
    trim(p_avatar),
    p_score,
    now()
  )
  on conflict on constraint duel_quiz_scores_pkey do update
  set
    nickname = excluded.nickname,
    avatar = excluded.avatar,
    score = greatest(current_score.score, excluded.score),
    completed_at = case
      when excluded.score > current_score.score then now()
      else current_score.completed_at
    end;

  return query
  select
    saved.tenant_id,
    saved.client_id,
    saved.nickname,
    saved.avatar,
    saved.score,
    saved.completed_at,
    (
      select count(*) + 1
      from public.duel_quiz_scores as better
      where better.tenant_id = saved.tenant_id
        and (
          better.score > saved.score
          or (
            better.score = saved.score
            and better.completed_at < saved.completed_at
          )
        )
    )::bigint as rank
  from public.duel_quiz_scores as saved
  where saved.tenant_id = trim(p_tenant_id)
    and saved.client_id = trim(p_client_id);
end;
$$;

revoke all on function public.submit_duel_quiz_score(
  text,
  text,
  text,
  text,
  integer
) from public;

grant execute on function public.submit_duel_quiz_score(
  text,
  text,
  text,
  text,
  integer
) to anon, authenticated;

create or replace function public.get_duel_quiz_leaderboard(
  p_tenant_id text,
  p_client_id text default null
)
returns table (
  tenant_id text,
  client_id text,
  nickname text,
  avatar text,
  score integer,
  completed_at timestamptz,
  rank bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with ranked as (
    select
      scores.tenant_id,
      scores.client_id,
      scores.nickname,
      scores.avatar,
      scores.score,
      scores.completed_at,
      row_number() over (
        order by scores.score desc, scores.completed_at asc
      )::bigint as rank
    from public.duel_quiz_scores as scores
    where scores.tenant_id = trim(p_tenant_id)
  )
  select
    ranked.tenant_id,
    ranked.client_id,
    ranked.nickname,
    ranked.avatar,
    ranked.score,
    ranked.completed_at,
    ranked.rank
  from ranked
  where ranked.rank <= 10
    or ranked.client_id = nullif(trim(p_client_id), '')
  order by ranked.rank;
$$;

revoke all on function public.get_duel_quiz_leaderboard(text, text)
  from public;
grant execute on function public.get_duel_quiz_leaderboard(text, text)
  to anon, authenticated;
