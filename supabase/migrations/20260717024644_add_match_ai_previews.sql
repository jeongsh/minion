create table if not exists public.match_ai_previews (
  match_id uuid primary key references public.matches(id) on delete cascade,
  input_hash text not null,
  model text not null,
  summary text not null,
  watch_point text not null,
  evidence jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

alter table public.match_ai_previews enable row level security;

revoke all on table public.match_ai_previews from anon, authenticated;
grant select, insert, update, delete on table public.match_ai_previews to service_role;

comment on table public.match_ai_previews is
  'Caches GPT-generated match previews by the hash of their deterministic source facts.';
