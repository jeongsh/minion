revoke all on function public.create_prediction_wallet_for_profile() from public, anon, authenticated;

create index if not exists prediction_bets_team_id_idx on public.prediction_bets(team_id);
create index if not exists prediction_wallet_ledger_bet_id_idx on public.prediction_wallet_ledger(bet_id);
create index if not exists prediction_wallet_ledger_match_id_idx on public.prediction_wallet_ledger(match_id);
