alter table public.tenant_settings
  add column if not exists enabled_games jsonb
  not null
  default '{"trivia": true, "emoji": true, "swipe": true, "number": true}'::jsonb;

