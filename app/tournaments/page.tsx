import { redirect } from "next/navigation";

import { getMatches, getTournaments } from "@/lib/data/lck";
import { buildSegmentNav, defaultSegmentKey } from "@/lib/tournaments/segment-nav";
import { isSupportedSeasonYear } from "@/lib/tournaments/season-2026";

// 대회가 LCK + 국제대회 5개뿐이라 목록 페이지를 따로 두면 클릭만 한 번 더 늘어난다.
// /tournaments는 진행중인 대회(없으면 LCK) 상세로 바로 보내고, 대회 전환은 상세 페이지
// 상단의 스위처(SegmentSwitcher)에서 처리한다.
export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const [tournaments, matches] = await Promise.all([getTournaments(), getMatches()]);

  const seasons = [...new Set(tournaments.map((tournament) => tournament.season).filter(isSupportedSeasonYear))].sort((a, b) => b - a);
  const latestSeason = seasons[0] ?? now.getFullYear();
  const requestedSeason = params.year ? Number(params.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : latestSeason;

  const seasonTournaments = tournaments.filter((tournament) => tournament.season === activeSeason);
  const items = buildSegmentNav(seasonTournaments, matches, now);

  redirect(`/tournaments/${defaultSegmentKey(items)}?year=${activeSeason}`);
}
