# Supabase local reproducibility

This project currently keeps migrations in `supabase/migrations`, but it does not
pin a local Supabase project config yet. Use this checklist before changing live
database or storage state.

## Required environment

Copy `.env.example` to `.env.local` and fill these values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_URL`
- `CRON_SECRET`

Do not expose `SUPABASE_SERVICE_ROLE_KEY` through any `NEXT_PUBLIC_` variable.

## Recommended workflow

1. Install and authenticate the Supabase CLI.
2. Run `supabase --help` and `supabase db --help` before using CLI commands.
3. Create local config with `supabase init` only after confirming the project ref
   and desired local ports.
4. Apply migrations locally and run advisors before touching production.
5. Add new database changes as new migration files. Do not edit historical
   migrations that may already have been applied elsewhere.

## Current upload security assumptions

- Community media uploads go through `app/api/community/upload/route.ts`.
- The route validates the authenticated Supabase user before using service role.
- The app limits community uploads to 6MB, verified image signatures, maximum
  4096x4096 dimensions, a short burst limit, and a per-user daily object count.
- Storage bucket limits are synced by
  `supabase/migrations/20260719000000_harden_community_media_uploads.sql`.

## Remaining live checks

Run Supabase advisors against the target project before deploy and verify:

- `search_path` is fixed on security-sensitive functions.
- Public storage object listing is not broader than intended.
- Foreign key indexes reported by the advisor are added.
- Leaked password protection is enabled in Auth settings if the project uses
  email/password sign-in.
