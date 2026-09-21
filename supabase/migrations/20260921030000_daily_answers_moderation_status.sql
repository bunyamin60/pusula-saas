-- Moderation status for masalar-arası günlük yanıtlar.

alter table public.daily_answers
  add column if not exists status text;

update public.daily_answers
set status = 'approved'
where status is null;

alter table public.daily_answers
  alter column status set default 'approved';

alter table public.daily_answers
  alter column status set not null;

alter table public.daily_answers
  drop constraint if exists daily_answers_status_check;

alter table public.daily_answers
  add constraint daily_answers_status_check
  check (status in ('approved', 'pending'));

create index if not exists daily_answers_pending_idx
  on public.daily_answers (tenant_id, created_at desc)
  where status = 'pending' and is_hidden = false;

create index if not exists daily_answers_approved_feed_idx
  on public.daily_answers (tenant_id, question_id, created_at desc)
  where status = 'approved' and is_hidden = false;
