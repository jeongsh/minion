import type { Metadata } from "next";

import { RecordsView } from "@/components/records/records-view";
import { PageHeader } from "@/components/ui/page-header";
import { getRecordsBaseData, getRecordsStatLines } from "@/lib/data/records-cache";
import { buildPlayerRecords, buildTeamRecords } from "@/lib/records";
import type { PlayerPosition } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "기록실 | MINION",
  description: "LCK 선수와 팀의 역대 기록과 통계를 확인하세요.",
};
type RecordsTab = "overview" | "players" | "teams";
const positions = new Set<PlayerPosition>(["TOP", "JGL", "MID", "BOT", "SUP"]);

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ tab?: string; season?: string; tournament?: string; position?: string }> }) {
  const params = await searchParams;
  const { tournaments, teams, players, matches, sets } = await getRecordsBaseData();
  const seasons = [...new Set(tournaments.map((item) => item.season))].sort((a, b) => b - a);
  const requestedSeason = Number(params.season);
  const season = seasons.includes(requestedSeason) ? requestedSeason : (seasons[0] ?? new Date().getFullYear());
  const seasonTournaments = tournaments.filter((item) => item.season === season);
  const tournamentId = seasonTournaments.some((item) => item.id === params.tournament) ? params.tournament! : "all";
  const tournamentIds = new Set(seasonTournaments.filter((item) => tournamentId === "all" || item.id === tournamentId).map((item) => item.id));
  const filteredMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  const matchIds = new Set(filteredMatches.map((match) => match.id));
  const filteredSets = sets.filter((set) => matchIds.has(set.matchId));
  const statLines = await getRecordsStatLines(filteredSets.map((set) => set.id));
  const position = positions.has(params.position as PlayerPosition) ? params.position as PlayerPosition : undefined;
  const tab: RecordsTab = params.tab === "players" || params.tab === "teams" ? params.tab : "overview";
  const playerRecords = buildPlayerRecords({ players, teams, sets: filteredSets, statLines, position });
  const teamRecords = buildTeamRecords({ teams, matches: filteredMatches, sets: filteredSets, statLines });
  const completedSets = filteredSets.filter((set) => set.status === "finished" || set.status === "data_synced" || Boolean(set.winnerTeamId));
  const averageDuration = completedSets.reduce((sum, set) => sum + (set.durationSeconds ?? 0) / 60, 0) / Math.max(completedSets.length, 1);

  return <main className="min-h-screen text-[var(--ui-text)]"><div className="layout-wide-max mx-auto flex w-full flex-col gap-10 px-5 pb-16 pt-8 xl:px-10">
    <div>
      <PageHeader eyebrow="RECORDS" title="기록실" action={<p className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-[13px] font-bold text-[var(--ui-muted)]">자동 집계</p>} />
      <p className="mt-3 text-sm leading-6 text-[var(--ui-muted)]">경기 결과와 세트 데이터를 기준으로 선수와 팀의 기록을 자동 집계합니다.</p>
    </div>
    <RecordsView tab={tab} tournaments={tournaments} season={season} tournamentId={tournamentId} position={position ?? "all"} playerRecords={playerRecords} teamRecords={teamRecords} matchCount={filteredMatches.filter((match) => match.status === "completed").length} setCount={completedSets.length} averageDuration={averageDuration} />
  </div></main>;
}
