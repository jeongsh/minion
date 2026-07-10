import { HomeDashboard, type HomeStandingRow } from "@/components/domain/home-dashboard";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import { getHomePagePublicData } from "@/lib/data/home-cache";
import type { Match } from "@/lib/types";
import { getBoardPosts } from "@/lib/data/community";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { getPredictionMarketData } from "@/lib/predictions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCelebrationMessages, getTodayCelebrations } from "@/lib/calendar/events";
import type { CelebrationBannerItem } from "@/components/domain/celebration-banner";

export const dynamic = "force-dynamic";

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
  const user = await getCurrentUser();
  const [homeData, communityPosts, predictionMarket] = await Promise.all([
    getHomePagePublicData(),
    getBoardPosts({ scope: "hub" }),
    getPredictionMarketData(user?.id),
  ]);
  const { teams, matches, savedStandings, tournaments, latestVideos, homeHeroSlides, calendarEvents } = homeData;

  // 오늘의 기념일 + 각 축하 보드 초기 메시지.
  const todayCelebrations = getTodayCelebrations(calendarEvents);
  const celebrationItems: CelebrationBannerItem[] = await Promise.all(
    todayCelebrations.map(async (event) => ({
      event,
      messages: await getCelebrationMessages(event.key),
    })),
  );

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
  const predictionBetsByMatchId = new Map<string, typeof predictionMarket.bets>();
  for (const bet of predictionMarket.bets) {
    predictionBetsByMatchId.set(bet.matchId, [...(predictionBetsByMatchId.get(bet.matchId) ?? []), bet]);
  }
  const tournamentNamesById = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));
  const tournamentLeagueById = new Map(tournaments.map((tournament) => [tournament.id, tournament.league ?? ""]));
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
      league: tournamentLeagueById.get(match.tournamentId) || "",
      teamAName: teamA?.shortName ?? "TBD",
      teamBName: teamB?.shortName ?? "TBD",
      teamALogoUrl: teamA?.logoUrl ?? null,
      teamBLogoUrl: teamB?.logoUrl ?? null,
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
      predictionBetsByMatchId={predictionBetsByMatchId}
      currentUserId={user?.id}
      predictionBalance={predictionMarket.balance}
      tournamentNamesById={tournamentNamesById}
      calendarMonthKey={calendarMonthKey}
      calendarMatches={calendarClientMatches}
      calendarEvents={calendarEvents}
      celebrationItems={celebrationItems}
      isLoggedIn={Boolean(user)}
      latestVideos={latestVideos}
      heroSlides={heroSlides}
      communityPosts={communityPosts.slice(0, 12)}
      stripMatches={stripMatches}
      stripTodayKey={stripTodayKey}
    />
  );
}
