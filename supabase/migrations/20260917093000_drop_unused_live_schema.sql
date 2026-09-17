-- Remove leftover gossip table and unused RPCs.
-- Align daily_answers column names with the app (author_label, body, like_count).

do $$
begin
  alter publication supabase_realtime drop table public.table_gossip_answers;
exception
  when undefined_table then null;
  when undefined_object then null;
end $$;

drop table if exists public.table_gossip_answers;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'author_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'author_label'
  ) then
    alter table public.daily_answers rename column author_name to author_label;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'author_name'
  ) then
    update public.daily_answers
    set author_label = coalesce(nullif(trim(author_label), ''), author_name)
    where author_label is null or trim(author_label) = '';
    alter table public.daily_answers drop column author_name;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'answer_text'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'body'
  ) then
    alter table public.daily_answers rename column answer_text to body;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'answer_text'
  ) then
    update public.daily_answers
    set body = coalesce(nullif(trim(body), ''), answer_text)
    where body is null or trim(body) = '';
    alter table public.daily_answers drop column answer_text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'likes_count'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'like_count'
  ) then
    alter table public.daily_answers rename column likes_count to like_count;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'likes_count'
  ) then
    update public.daily_answers
    set like_count = coalesce(like_count, likes_count, 0);
    alter table public.daily_answers drop column likes_count;
  end if;
end $$;

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

drop function if exists public.publish_daily_question(text, text);
drop function if exists public.get_venue_settings(text);
drop function if exists public.upsert_venue_settings(text, integer, text, jsonb);
drop function if exists public.register_reward_coupon(text, text, text, text);
drop function if exists public.redeem_reward_coupon(text, text);
drop function if exists public.list_today_redeemed_coupons(text);
drop function if exists public.reward_coupon_metrics(text);
drop table if exists public.venue_settings;
