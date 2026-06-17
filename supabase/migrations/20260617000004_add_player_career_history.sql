CREATE TABLE IF NOT EXISTS public.player_career_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  team_name TEXT,
  position TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_career_history_player_id
  ON public.player_career_history(player_id);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS retired_at DATE;
