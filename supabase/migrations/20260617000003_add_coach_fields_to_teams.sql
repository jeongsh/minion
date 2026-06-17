ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS head_coach text,
  ADD COLUMN IF NOT EXISTS coaches text;
