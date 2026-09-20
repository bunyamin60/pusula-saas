-- Per-category high scores on the same leaderboard table.
-- PK becomes (tenant_id, client_id, game_type, category).
-- Block Blast keeps category = ''.

alter table public.duel_quiz_scores
  add column if not exists category text not null default '';

update public.duel_quiz_scores
set category = ''
where category is null;

alter table public.duel_quiz_scores
  drop constraint if exists duel_quiz_scores_pkey;

alter table public.duel_quiz_scores
  add primary key (tenant_id, client_id, game_type, category);

drop index if exists public.duel_quiz_scores_ranking_idx;
create index if not exists duel_quiz_scores_ranking_idx
  on public.duel_quiz_scores (tenant_id, game_type, category, score desc, completed_at asc);

drop function if exists public.submit_duel_quiz_score(text, text, text, text, integer, text, text);
drop function if exists public.submit_duel_quiz_score(text, text, text, text, integer, text, text, text);
drop function if exists public.submit_duel_quiz_score(text, text, text, text, integer, text, text, text, text);
drop function if exists public.get_duel_quiz_leaderboard(text, text, text);
drop function if exists public.get_duel_quiz_leaderboard(text, text, text, text);

create or replace function public.submit_duel_quiz_score(
  p_tenant_id text,
  p_client_id text,
  p_nickname text,
  p_avatar text,
  p_score integer,
  p_game_type text default 'quiz',
  p_table_id text default null,
  p_avatar_url text default null,
  p_category text default ''
)
returns table (
  tenant_id text,
  client_id text,
  nickname text,
  avatar text,
  score integer,
  completed_at timestamptz,
  rank bigint,
  game_type text,
  table_id text,
  avatar_url text,
  category text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_type text := lower(nullif(trim(p_game_type), ''));
  next_table text := nullif(trim(coalesce(p_table_id, '')), '');
  next_avatar_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  next_category text := lower(trim(coalesce(p_category, '')));
begin
  if next_type is null then
    next_type := 'quiz';
  end if;

  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(trim(p_client_id)) not between 8 and 128
    or char_length(trim(p_nickname)) not between 1 and 64
    or char_length(trim(p_avatar)) not between 1 and 16
    or char_length(next_type) not between 1 and 32
    or char_length(next_category) > 32
    or p_score not between 0 and 999999 then
    raise exception 'invalid_quiz_score';
  end if;

  if next_table is not null and char_length(next_table) > 64 then
    raise exception 'invalid_quiz_score';
  end if;

  if next_avatar_url is not null and char_length(next_avatar_url) > 160 then
    raise exception 'invalid_quiz_score';
  end if;

  insert into public.duel_quiz_scores as current_score (
    tenant_id,
    client_id,
    game_type,
    category,
    nickname,
    avatar,
    score,
    completed_at,
    table_id,
    avatar_url
  )
  values (
    trim(p_tenant_id),
    trim(p_client_id),
    next_type,
    next_category,
    trim(p_nickname),
    trim(p_avatar),
    p_score,
    now(),
    next_table,
    next_avatar_url
  )
  on conflict on constraint duel_quiz_scores_pkey do update
  set
    nickname = excluded.nickname,
    avatar = excluded.avatar,
    score = greatest(current_score.score, excluded.score),
    completed_at = case
      when excluded.score > current_score.score then now()
      else current_score.completed_at
    end,
    table_id = case
      when excluded.score > current_score.score then excluded.table_id
      else coalesce(current_score.table_id, excluded.table_id)
    end,
    avatar_url = case
      when excluded.avatar_url is not null then excluded.avatar_url
      else current_score.avatar_url
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
        and better.game_type = saved.game_type
        and better.category = saved.category
        and (
          better.score > saved.score
          or (
            better.score = saved.score
            and better.completed_at < saved.completed_at
          )
        )
    )::bigint as rank,
    saved.game_type,
    saved.table_id,
    saved.avatar_url,
    saved.category
  from public.duel_quiz_scores as saved
  where saved.tenant_id = trim(p_tenant_id)
    and saved.client_id = trim(p_client_id)
    and saved.game_type = next_type
    and saved.category = next_category;
end;
$$;

revoke all on function public.submit_duel_quiz_score(
  text, text, text, text, integer, text, text, text, text
) from public;
grant execute on function public.submit_duel_quiz_score(
  text, text, text, text, integer, text, text, text, text
) to anon, authenticated;

create or replace function public.get_duel_quiz_leaderboard(
  p_tenant_id text,
  p_client_id text default null,
  p_game_type text default 'quiz',
  p_category text default null
)
returns table (
  tenant_id text,
  client_id text,
  nickname text,
  avatar text,
  score integer,
  completed_at timestamptz,
  rank bigint,
  game_type text,
  table_id text,
  avatar_url text,
  category text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with scoped as (
    select
      scores.tenant_id,
      scores.client_id,
      scores.nickname,
      scores.avatar,
      scores.score,
      scores.completed_at,
      scores.game_type,
      scores.table_id,
      scores.avatar_url,
      scores.category
    from public.duel_quiz_scores as scores
    where scores.tenant_id = trim(p_tenant_id)
      and scores.game_type = lower(coalesce(nullif(trim(p_game_type), ''), 'quiz'))
      and (
        p_category is null
        or trim(p_category) = ''
        or scores.category = lower(trim(p_category))
      )
  ),
  best as (
    select distinct on (scoped.client_id)
      scoped.*
    from scoped
    order by scoped.client_id, scoped.score desc, scoped.completed_at asc
  ),
  ranked as (
    select
      best.*,
      row_number() over (
        order by best.score desc, best.completed_at asc
      )::bigint as rank
    from best
  )
  select
    ranked.tenant_id,
    ranked.client_id,
    ranked.nickname,
    ranked.avatar,
    ranked.score,
    ranked.completed_at,
    ranked.rank,
    ranked.game_type,
    ranked.table_id,
    ranked.avatar_url,
    ranked.category
  from ranked
  where ranked.rank <= 10
    or ranked.client_id = nullif(trim(p_client_id), '')
  order by ranked.rank;
$$;

revoke all on function public.get_duel_quiz_leaderboard(text, text, text, text) from public;
grant execute on function public.get_duel_quiz_leaderboard(text, text, text, text)
  to anon, authenticated;
