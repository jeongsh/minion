alter table public.teams
  add column if not exists use_white_logo_on_dark boolean not null default false;
