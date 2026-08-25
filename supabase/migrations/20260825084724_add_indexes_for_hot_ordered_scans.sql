-- 자주 호출되는 전체 스캔 쿼리들이 ORDER BY 대상 컬럼에 인덱스가 없어
-- 매번 seq scan + sort를 반복하던 문제를 해결한다(Disk IO 예산 소진 원인).
-- lib/data/lck.ts: getSetsBase() .order("created_at desc")
create index if not exists idx_sets_created_at on public.sets (created_at desc);

-- lib/data/lck.ts: getPlayerStatLinesBase() .order("position").order("set_id")
create index if not exists idx_set_player_stats_position_set_id on public.set_player_stats (position, set_id);

-- lib/data/lck.ts: getSetPicksBansBase() .order("order_index").order("set_id")
create index if not exists idx_set_picks_bans_order_index_set_id on public.set_picks_bans (order_index, set_id);
