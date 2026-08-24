-- Opaque, short-lived handoff codes for server-brokered native OAuth (Naver).
-- Raw codes are never stored and Supabase access/refresh tokens never appear in a URL.
create table public.mobile_auth_exchange_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index mobile_auth_exchange_codes_expiry_idx
  on public.mobile_auth_exchange_codes (expires_at)
  where consumed_at is null;

alter table public.mobile_auth_exchange_codes enable row level security;
revoke all on table public.mobile_auth_exchange_codes from public, anon, authenticated;
