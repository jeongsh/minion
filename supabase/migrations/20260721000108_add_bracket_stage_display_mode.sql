alter table bracket_stages
  add column display_mode text not null default 'bracket'
  check (display_mode in ('bracket', 'standings'));
