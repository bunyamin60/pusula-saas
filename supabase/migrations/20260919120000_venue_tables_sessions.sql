-- Venue floor tables + live guest sessions (admin occupancy / QR masa).

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  code text not null,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (char_length(trim(tenant_id)) between 1 and 80),
  check (char_length(trim(code)) between 1 and 32),
  check (char_length(trim(label)) between 1 and 64)
);

create index if not exists tables_tenant_active_idx
  on public.tables (tenant_id, is_active, sort_order);

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  table_id uuid not null references public.tables (id) on delete cascade,
  table_code text not null,
  client_id text not null,
  nickname text,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  game_type text,
  game_started_at timestamptz,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  check (char_length(trim(tenant_id)) between 1 and 80),
  check (char_length(trim(client_id)) between 8 and 128),
  check (char_length(trim(table_code)) between 1 and 32)
);

create unique index if not exists table_sessions_one_active_per_client
  on public.table_sessions (tenant_id, client_id)
  where status = 'active';

create index if not exists table_sessions_live_idx
  on public.table_sessions (tenant_id, status, last_seen_at desc);

create index if not exists table_sessions_table_live_idx
  on public.table_sessions (tenant_id, table_id, status)
  where status = 'active';

alter table public.tables enable row level security;
alter table public.table_sessions enable row level security;

drop policy if exists "tables are publicly readable" on public.tables;
create policy "tables are publicly readable"
  on public.tables
  for select
  to anon, authenticated
  using (true);

drop policy if exists "table sessions are publicly readable" on public.table_sessions;
create policy "table sessions are publicly readable"
  on public.table_sessions
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.tables from anon, authenticated;
revoke insert, update, delete on public.table_sessions from anon, authenticated;
grant select on public.tables to anon, authenticated;
grant select on public.table_sessions to anon, authenticated;

-- Soft table label on scores (which masa scored).
alter table public.duel_quiz_scores
  add column if not exists table_id text;

create index if not exists duel_quiz_scores_table_idx
  on public.duel_quiz_scores (tenant_id, game_type, table_id);

-- Ensure / resolve a venue table by QR code (e.g. "4" → Masa #4).
create or replace function public.ensure_venue_table(
  p_tenant_id text,
  p_code text,
  p_label text default null
)
returns table (
  id uuid,
  tenant_id text,
  code text,
  label text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_code text := lower(trim(p_code));
  next_label text := nullif(trim(coalesce(p_label, '')), '');
begin
  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(next_code) not between 1 and 32 then
    raise exception 'invalid_venue_table';
  end if;

  -- Accept "masa 4" / "m4" / "4"
  next_code := regexp_replace(next_code, '^masa[\s#_:-]*', '', 'i');
  next_code := regexp_replace(next_code, '^m[\s#_:-]*', '', 'i');
  next_code := regexp_replace(next_code, '[^a-z0-9_-]', '', 'g');
  if char_length(next_code) < 1 then
    raise exception 'invalid_venue_table';
  end if;

  if next_label is null then
    if next_code ~ '^[0-9]+$' then
      next_label := 'Masa #' || next_code;
    else
      next_label := 'Masa ' || next_code;
    end if;
  end if;

  insert into public.tables as t (tenant_id, code, label, sort_order)
  values (
    trim(p_tenant_id),
    next_code,
    next_label,
    case when next_code ~ '^[0-9]+$' then next_code::integer else 0 end
  )
  on conflict (tenant_id, code) do update
  set
    label = excluded.label,
    is_active = true
  returning t.id, t.tenant_id, t.code, t.label
  into id, tenant_id, code, label;

  return next;
end;
$$;

revoke all on function public.ensure_venue_table(text, text, text) from public;
grant execute on function public.ensure_venue_table(text, text, text)
  to anon, authenticated;

-- Guest scans QR → open/refresh active session at that masa.
create or replace function public.join_table_session(
  p_tenant_id text,
  p_table_code text,
  p_client_id text,
  p_nickname text default null
)
returns table (
  session_id uuid,
  table_id uuid,
  table_code text,
  table_label text,
  status text,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ensured record;
  next_nick text := nullif(trim(coalesce(p_nickname, '')), '');
  updated_id uuid;
begin
  if char_length(trim(p_client_id)) not between 8 and 128 then
    raise exception 'invalid_table_session';
  end if;

  select * into ensured
  from public.ensure_venue_table(p_tenant_id, p_table_code, null)
  limit 1;

  update public.table_sessions as s
  set
    table_id = ensured.id,
    table_code = ensured.code,
    nickname = coalesce(next_nick, s.nickname),
    status = 'active',
    ended_at = null,
    last_seen_at = now()
  where s.tenant_id = trim(p_tenant_id)
    and s.client_id = trim(p_client_id)
    and s.status = 'active'
  returning s.id into updated_id;

  if updated_id is null then
    insert into public.table_sessions (
      tenant_id,
      table_id,
      table_code,
      client_id,
      nickname,
      status
    )
    values (
      trim(p_tenant_id),
      ensured.id,
      ensured.code,
      trim(p_client_id),
      next_nick,
      'active'
    )
    returning id into updated_id;
  end if;

  return query
  select
    s.id,
    s.table_id,
    s.table_code,
    t.label,
    s.status,
    s.started_at
  from public.table_sessions as s
  join public.tables as t on t.id = s.table_id
  where s.id = updated_id;
end;
$$;

revoke all on function public.join_table_session(text, text, text, text) from public;
grant execute on function public.join_table_session(text, text, text, text)
  to anon, authenticated;

-- Guest enters a game → stamp game_type + start time for admin live view.
create or replace function public.start_table_game(
  p_tenant_id text,
  p_client_id text,
  p_game_type text
)
returns table (
  session_id uuid,
  table_code text,
  table_label text,
  game_type text,
  game_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_game text := lower(nullif(trim(p_game_type), ''));
begin
  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(trim(p_client_id)) not between 8 and 128
    or next_game is null
    or char_length(next_game) not between 1 and 32 then
    raise exception 'invalid_table_game';
  end if;

  update public.table_sessions as s
  set
    game_type = next_game,
    game_started_at = now(),
    last_seen_at = now()
  where s.tenant_id = trim(p_tenant_id)
    and s.client_id = trim(p_client_id)
    and s.status = 'active';

  return query
  select
    s.id,
    s.table_code,
    t.label,
    s.game_type,
    s.game_started_at
  from public.table_sessions as s
  join public.tables as t on t.id = s.table_id
  where s.tenant_id = trim(p_tenant_id)
    and s.client_id = trim(p_client_id)
    and s.status = 'active'
  limit 1;
end;
$$;

revoke all on function public.start_table_game(text, text, text) from public;
grant execute on function public.start_table_game(text, text, text)
  to anon, authenticated;

create or replace function public.end_table_game(
  p_tenant_id text,
  p_client_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.table_sessions as s
  set
    game_type = null,
    game_started_at = null,
    last_seen_at = now()
  where s.tenant_id = trim(p_tenant_id)
    and s.client_id = trim(p_client_id)
    and s.status = 'active';
end;
$$;

revoke all on function public.end_table_game(text, text) from public;
grant execute on function public.end_table_game(text, text)
  to anon, authenticated;

create or replace function public.get_active_table_sessions(
  p_tenant_id text
)
returns table (
  session_id uuid,
  table_code text,
  table_label text,
  client_id text,
  nickname text,
  game_type text,
  game_started_at timestamptz,
  started_at timestamptz,
  last_seen_at timestamptz,
  minutes_at_table integer,
  minutes_in_game integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    s.id as session_id,
    s.table_code,
    t.label as table_label,
    s.client_id,
    s.nickname,
    s.game_type,
    s.game_started_at,
    s.started_at,
    s.last_seen_at,
    greatest(0, floor(extract(epoch from (now() - s.started_at)) / 60))::integer
      as minutes_at_table,
    case
      when s.game_started_at is null then null
      else greatest(
        0,
        floor(extract(epoch from (now() - s.game_started_at)) / 60)
      )::integer
    end as minutes_in_game
  from public.table_sessions as s
  join public.tables as t on t.id = s.table_id
  where s.tenant_id = trim(p_tenant_id)
    and s.status = 'active'
  order by t.sort_order, s.table_code, s.started_at;
$$;

revoke all on function public.get_active_table_sessions(text) from public;
grant execute on function public.get_active_table_sessions(text)
  to anon, authenticated;

-- Realtime for admin live masa board.
alter table public.table_sessions replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.table_sessions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Extend score RPC with optional table_id (keep PK unchanged).
drop function if exists public.submit_duel_quiz_score(text, text, text, text, integer, text);

create or replace function public.submit_duel_quiz_score(
  p_tenant_id text,
  p_client_id text,
  p_nickname text,
  p_avatar text,
  p_score integer,
  p_game_type text default 'quiz',
  p_table_id text default null
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
  table_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_type text := lower(nullif(trim(p_game_type), ''));
  next_table text := nullif(trim(coalesce(p_table_id, '')), '');
begin
  if next_type is null then
    next_type := 'quiz';
  end if;

  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(trim(p_client_id)) not between 8 and 128
    or char_length(trim(p_nickname)) not between 1 and 64
    or char_length(trim(p_avatar)) not between 1 and 16
    or char_length(next_type) not between 1 and 32
    or p_score not between 0 and 999999 then
    raise exception 'invalid_quiz_score';
  end if;

  if next_table is not null and char_length(next_table) > 64 then
    raise exception 'invalid_quiz_score';
  end if;

  insert into public.duel_quiz_scores as current_score (
    tenant_id,
    client_id,
    game_type,
    nickname,
    avatar,
    score,
    completed_at,
    table_id
  )
  values (
    trim(p_tenant_id),
    trim(p_client_id),
    next_type,
    trim(p_nickname),
    trim(p_avatar),
    p_score,
    now(),
    next_table
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
        and (
          better.score > saved.score
          or (
            better.score = saved.score
            and better.completed_at < saved.completed_at
          )
        )
    )::bigint as rank,
    saved.game_type,
    saved.table_id
  from public.duel_quiz_scores as saved
  where saved.tenant_id = trim(p_tenant_id)
    and saved.client_id = trim(p_client_id)
    and saved.game_type = next_type;
end;
$$;

revoke all on function public.submit_duel_quiz_score(
  text, text, text, text, integer, text, text
) from public;
grant execute on function public.submit_duel_quiz_score(
  text, text, text, text, integer, text, text
) to anon, authenticated;

drop function if exists public.get_duel_quiz_leaderboard(text, text, text);

create or replace function public.get_duel_quiz_leaderboard(
  p_tenant_id text,
  p_client_id text default null,
  p_game_type text default 'quiz'
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
  table_id text
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
      scores.game_type,
      scores.table_id,
      row_number() over (
        order by scores.score desc, scores.completed_at asc
      )::bigint as rank
    from public.duel_quiz_scores as scores
    where scores.tenant_id = trim(p_tenant_id)
      and scores.game_type = lower(coalesce(nullif(trim(p_game_type), ''), 'quiz'))
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
    ranked.table_id
  from ranked
  where ranked.rank <= 10
    or ranked.client_id = nullif(trim(p_client_id), '')
  order by ranked.rank;
$$;

revoke all on function public.get_duel_quiz_leaderboard(text, text, text) from public;
grant execute on function public.get_duel_quiz_leaderboard(text, text, text)
  to anon, authenticated;
