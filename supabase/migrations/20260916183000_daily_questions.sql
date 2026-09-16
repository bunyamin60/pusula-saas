create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  prompt text not null check (char_length(trim(prompt)) between 4 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists daily_questions_active_tenant_idx
  on public.daily_questions (tenant_id)
  where is_active;

create index if not exists daily_questions_tenant_idx
  on public.daily_questions (tenant_id, created_at desc);

create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  question_id uuid not null references public.daily_questions (id) on delete cascade,
  author_label text not null check (char_length(trim(author_label)) between 1 and 64),
  body text not null check (char_length(trim(body)) between 1 and 120),
  like_count integer not null default 0 check (like_count >= 0),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists daily_answers_feed_idx
  on public.daily_answers (tenant_id, question_id, created_at desc)
  where is_hidden = false;

create index if not exists daily_answers_moderation_idx
  on public.daily_answers (tenant_id, created_at desc);

create table if not exists public.daily_answer_likes (
  answer_id uuid not null references public.daily_answers (id) on delete cascade,
  client_id text not null check (char_length(trim(client_id)) between 8 and 128),
  created_at timestamptz not null default now(),
  primary key (answer_id, client_id)
);

alter table public.daily_questions replica identity full;
alter table public.daily_answers replica identity full;

alter table public.daily_questions enable row level security;
alter table public.daily_answers enable row level security;
alter table public.daily_answer_likes enable row level security;

grant select, insert, update on public.daily_questions to anon, authenticated;
grant select, insert, update on public.daily_answers to anon, authenticated;
grant select, insert on public.daily_answer_likes to anon, authenticated;

drop policy if exists "daily_questions_select" on public.daily_questions;
drop policy if exists "daily_questions_insert" on public.daily_questions;
drop policy if exists "daily_questions_update" on public.daily_questions;
drop policy if exists "daily_answers_select" on public.daily_answers;
drop policy if exists "daily_answers_insert" on public.daily_answers;
drop policy if exists "daily_answers_update" on public.daily_answers;
drop policy if exists "daily_answer_likes_select" on public.daily_answer_likes;
drop policy if exists "daily_answer_likes_insert" on public.daily_answer_likes;

create policy "daily_questions_select"
  on public.daily_questions for select to anon, authenticated using (true);
create policy "daily_questions_insert"
  on public.daily_questions for insert to anon, authenticated with check (true);
create policy "daily_questions_update"
  on public.daily_questions for update to anon, authenticated using (true) with check (true);

create policy "daily_answers_select"
  on public.daily_answers for select to anon, authenticated using (true);
create policy "daily_answers_insert"
  on public.daily_answers for insert to anon, authenticated with check (true);
create policy "daily_answers_update"
  on public.daily_answers for update to anon, authenticated using (true) with check (true);

create policy "daily_answer_likes_select"
  on public.daily_answer_likes for select to anon, authenticated using (true);
create policy "daily_answer_likes_insert"
  on public.daily_answer_likes for insert to anon, authenticated with check (true);

create or replace function public.publish_daily_question(
  p_tenant_id text,
  p_prompt text
)
returns table (
  id uuid,
  tenant_id text,
  prompt text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_prompt text := trim(p_prompt);
begin
  if char_length(trim(p_tenant_id)) not between 1 and 80
    or char_length(next_prompt) not between 4 and 180 then
    raise exception 'invalid_daily_question';
  end if;

  update public.daily_questions
  set is_active = false
  where tenant_id = trim(p_tenant_id)
    and is_active;

  return query
  insert into public.daily_questions (tenant_id, prompt, is_active)
  values (trim(p_tenant_id), next_prompt, true)
  returning
    daily_questions.id,
    daily_questions.tenant_id,
    daily_questions.prompt,
    daily_questions.is_active,
    daily_questions.created_at;
end;
$$;

create or replace function public.like_daily_answer(
  p_answer_id uuid,
  p_client_id text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_count integer;
  inserted integer;
begin
  if char_length(trim(p_client_id)) not between 8 and 128 then
    raise exception 'invalid_like';
  end if;

  insert into public.daily_answer_likes (answer_id, client_id)
  values (p_answer_id, trim(p_client_id))
  on conflict do nothing;

  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.daily_answers
    set like_count = like_count + 1
    where id = p_answer_id
      and is_hidden = false;
  end if;

  select like_count into next_count
  from public.daily_answers
  where id = p_answer_id;

  return coalesce(next_count, 0);
end;
$$;

revoke all on function public.publish_daily_question(text, text) from public;
grant execute on function public.publish_daily_question(text, text) to anon, authenticated;

revoke all on function public.like_daily_answer(uuid, text) from public;
grant execute on function public.like_daily_answer(uuid, text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.daily_questions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.daily_answers;
exception
  when duplicate_object then null;
end $$;

insert into public.daily_questions (tenant_id, prompt, is_active)
select 'arada_cadde54', 'Bu masada duyduğun en saçma sipariş neydi?', true
where not exists (
  select 1 from public.daily_questions
  where tenant_id = 'arada_cadde54' and is_active
);
