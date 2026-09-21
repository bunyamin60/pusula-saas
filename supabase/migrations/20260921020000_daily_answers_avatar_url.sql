-- Persist guest avatar on daily answer rows for the lobby gossip feed.

alter table public.daily_answers
  add column if not exists avatar_url text;

alter table public.daily_answers
  drop constraint if exists daily_answers_avatar_url_len;

alter table public.daily_answers
  add constraint daily_answers_avatar_url_len
  check (avatar_url is null or char_length(trim(avatar_url)) between 1 and 160);
