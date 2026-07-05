import { HomeDashboard, type HomeStandingRow } from "@/components/domain/home-dashboard";
import type { HomeCalendarMatch } from "@/components/domain/home-match-calendar";
import {
  getAllTeams,
  getFanMatchPredictions,
  getHomeHeroSlides,
  getLatestTeamVideos,
  getMatches,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import type { Match } from "@/lib/types";
import { getBoardPosts } from "@/lib/data/community";
import { formatTimeKST, matchHref } from "@/lib/view-data";

export const dynamic = "force-dynamic";

function dateKeyKST(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function yearMonthKeyKST(value: string) {
  return dateKeyKST(value).slice(0, 7);
}

function buildRecentForm(teamId: string, matches: Match[]) {
  return matches
    .filter((match) => match.status === "completed" && (match.teamAId === teamId || match.teamBId === teamId))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 5)
    .map((match) => (match.winnerTeamId === teamId ? "W" : "L") as "W" | "L");
}

export default async function HomePage() {
  const [teams, matches, savedStandings, tournaments, latestVideos, homeHeroSlides, communityPosts] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getTeamStandings(),
    getTournaments(),
    getLatestTeamVideos(4),
    getHomeHeroSlides({ limit: 8 }),
    getBoardPosts({ scope: "hub" }),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latestSeason = tournaments.length > 0 ? Math.max(...tournaments.map((tournament) => tournament.season)) : 2026;
  const latestTournamentIds = new Set(
    tournaments.filter((tournament) => tournament.season === latestSeason).map((tournament) => tournament.id),
  );
  const standingRows = savedStandings
    .filter((standing) => latestTournamentIds.has(standing.tournamentId))
    .map((standing) => {
      const team = teamsById.get(standing.teamId);
      if (!team) return null;

      return {
        team,
        teamId: standing.teamId,
        rank: standing.rank,
        wins: standing.wins,
        losses: standing.losses,
        setDiff: standing.setDiff,
        recent: buildRecentForm(standing.teamId, matches),
      };
    })
    .filter((row): row is HomeStandingRow => row !== null)
    .sort((a, b) => a.rank - b.rank);

  const upcomingMatches = matches
    .filter((match) => match.status !== "completed")
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    .slice(0, 8);
  const recentMatches = matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 2);
  const todayKey = dateKeyKST(new Date());
  const matchesByDate = new Map<string, Match[]>();
  for (const match of matches) {
    const key = dateKeyKST(match.matchDate);
    matchesByDate.set(key, [...(matchesByDate.get(key) ?? []), match]);
  }
  const displayDateKey = matchesByDate.has(todayKey)
    ? todayKey
    : [...matchesByDate.keys()].filter((key) => key < todayKey).sort().at(-1) ?? todayKey;
  const todayMatches = (matchesByDate.get(displayDateKey) ?? []).sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );
  const predictionTargets = new Map([...upcomingMatches, ...todayMatches].map((match) => [match.id, match]));
  const predictionEntries = await Promise.all(
    [...predictionTargets.values()].map(async (match) => [match.id, await getFanMatchPredictions(match.id)] as const),
  );
  const predictionsByMatchId = new Map(predictionEntries);
  const tournamentNamesById = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));
  const calendarMonthKey = todayKey.slice(0, 7);
  const calendarMatches = matches
    .filter((match) => yearMonthKeyKST(match.matchDate) === calendarMonthKey)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const calendarClientMatches: HomeCalendarMatch[] = calendarMatches.map((match) => {
    const teamA = teamsById.get(match.teamAId);
    const teamB = teamsById.get(match.teamBId);

    return {
      id: match.id,
      dateKey: dateKeyKST(match.matchDate),
      href: matchHref(match),
      time: formatTimeKST(match.matchDate),
      title: match.name?.trim() || `${teamA?.shortName ?? "TBD"} vs ${teamB?.shortName ?? "TBD"}`,
      teams: `${teamA?.shortName ?? "TBD"} vs ${teamB?.shortName ?? "TBD"}`,
    };
  });
  const heroSlides = homeHeroSlides.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    alt: slide.title,
    href: slide.linkUrl,
  }));

  // 상단 일정 스트립: 오늘부터 일주일 치 경기. 이번 주 경기가 없으면 가장 가까운 경기일로 대체한다.
  const byDateAsc = (a: Match, b: Match) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
  const today = new Date();
  const stripTodayKey = dateKeyKST(today);
  const weekEndKey = dateKeyKST(new Date(today.getTime() + 6 * 86400000));
  const hasKnownTeam = (match: Match) => teamsById.has(match.teamAId) || teamsById.has(match.teamBId);
  let stripMatches = matches
    .filter((match) => {
      const key = dateKeyKST(match.matchDate);
      return key >= stripTodayKey && key <= weekEndKey && hasKnownTeam(match);
    })
    .sort(byDateAsc)
    .slice(0, 12);
  if (stripMatches.length === 0 && upcomingMatches[0]) {
    const nextKey = dateKeyKST(upcomingMatches[0].matchDate);
    stripMatches = matches.filter((match) => dateKeyKST(match.matchDate) === nextKey).sort(byDateAsc);
  }

  return (
    <HomeDashboard
      teams={teams}
      standingRows={standingRows}
      upcomingMatches={upcomingMatches}
      recentMatches={recentMatches}
      todayMatches={todayMatches}
      predictionsByMatchId={predictionsByMatchId}
      tournamentNamesById={tournamentNamesById}
      calendarMonthKey={calendarMonthKey}
      calendarMatches={calendarClientMatches}
      latestVideos={latestVideos}
      heroSlides={heroSlides}
      communityPosts={communityPosts.slice(0, 12)}
      stripMatches={stripMatches}
      stripTodayKey={stripTodayKey}
    />
  );
}
