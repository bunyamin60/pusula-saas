-- Guest profile image path for nickname+PIN auth.

alter table public.customers
  add column if not exists avatar_url text;

comment on column public.customers.avatar_url is
  'Public path under /images/avatar/… chosen at guest sign-in';
