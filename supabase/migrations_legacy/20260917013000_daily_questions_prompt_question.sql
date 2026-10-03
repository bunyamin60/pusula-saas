-- Align live schema with both prompt and question columns used by the admin publisher.

alter table public.daily_questions
  add column if not exists prompt text;

alter table public.daily_questions
  add column if not exists question text;

update public.daily_questions
set prompt = coalesce(nullif(trim(prompt), ''), question)
where prompt is null or trim(prompt) = '';

update public.daily_questions
set question = coalesce(nullif(trim(question), ''), prompt)
where question is null or trim(question) = '';
