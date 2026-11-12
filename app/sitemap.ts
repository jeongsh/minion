import type { MetadataRoute } from "next";
import { getBoardPosts } from "@/lib/data/community";
import { getChampions, getMatches, getPlayers, getTeams, getTournaments } from "@/lib/data/lck";
import { siteBaseUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferMarketUpdatedAt } from "@/lib/transfers/types";
import { canQuerySupabase } from "@/lib/supabase/server";
import { DOMESTIC_SEGMENTS, INTERNATIONAL_SEGMENTS } from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import { matchHref } from "@/lib/view-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl();
  // 실제 콘텐츠 수정 시각을 알 수 없는 URL은 lastModified를 생략한다.
  // 생성 시각이나 경기 예정일은 페이지의 최종 수정일이 아니다.
  const staticChangeFrequency = (route: string): MetadataRoute.Sitemap[number]["changeFrequency"] =>
    route === "" || route === "/transfers" ? "daily" : "weekly";
  const routes = [
    "",
    "/schedule",
    "/transfers",
    "/teams",
    "/players",
    "/champions",
    "/news",
    "/minicons",
    "/predictions",
    "/policies",
    "/privacy",
    "/terms",
    "/advertising",
    "/support",
    "/about",
  ];

  const staticRoutes = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: staticChangeFrequency(route),
    priority: route === "" ? 1 : route.startsWith("/polic") || route === "/privacy" || route === "/terms" || route === "/advertising" || route === "/support" ? 0.3 : 0.8,
  }));

  if (!canQuerySupabase()) return staticRoutes;

  // 이적시장은 루머·오피셜이 수시로 바뀌므로 실제 마지막 변경 시각을 알린다.
  const transferMarket = await getTransferMarket().catch(() => null);
  if (transferMarket) {
    const transfersRoute = staticRoutes.find((route) => route.url === `${baseUrl}/transfers`);
    if (transfersRoute) Object.assign(transfersRoute, { lastModified: transferMarketUpdatedAt(transferMarket) });
  }

  try {
    const [teams, players, matches, tournaments, champions] = await Promise.all([
      getTeams(),
      getPlayers(),
      getMatches(),
      getTournaments(),
      // 챔피언 목록을 못 읽어도 나머지 사이트맵은 그대로 낸다.
      getChampions().catch(() => []),
    ]);

    const teamRoutes = teams.map((team) => ({
        url: `${baseUrl}/fan/${team.fanSiteHost}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));

    // 팀 팬톡 첫 화면과 팀별 인기글(블라인드 제외)만 제출한다. 일반 글은 링크로 발견되게 둔다.
    const fanTalkRoutes = teams.map((team) => ({
      url: `${baseUrl}/fan/${team.fanSiteHost}/community`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
    const hotPostsByTeam = await Promise.all(
      teams.map((team) => getBoardPosts({ scope: "team", teamId: team.id, hotOnly: true, limit: 30 }).catch(() => [])),
    );
    const fanTalkPostRoutes = teams.flatMap((team, index) =>
      hotPostsByTeam[index]
        .filter((post) => !post.blindedAt && !post.deletedAt)
        .map((post) => ({
          url: `${baseUrl}/fan/${team.fanSiteHost}/community/post/${post.id}`,
          lastModified: post.createdAt,
          changeFrequency: "weekly" as const,
          priority: 0.5,
        })),
    );

    const playerRoutes = players.map((player) => ({
      url: `${baseUrl}/players/${player.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // 예정 경기는 AI 프리뷰가 생성·갱신된 시각을 최종 수정일로 쓴다.
    const scheduledIds = matches.filter((match) => match.status === "scheduled").map((match) => match.id);
    const previewUpdatedAt = await scheduledPreviewTimes(scheduledIds);
    const matchRoutes = matches.map((match) => ({
      url: `${baseUrl}${matchHref(match)}`,
      ...(previewUpdatedAt.has(match.id) ? { lastModified: previewUpdatedAt.get(match.id) } : {}),
      changeFrequency: match.status === "scheduled" ? ("daily" as const) : ("monthly" as const),
      priority: match.status === "scheduled" ? 0.75 : 0.55,
    }));

    const tournamentRoutes = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS]
      .filter((segment) => {
        const segmentTournaments = tournaments.filter((tournament) => matchesTournamentSegment(tournament, segment.key));
        const latestSeason = Math.max(...segmentTournaments.map((tournament) => tournament.season));
        const visibleTournamentIds = new Set(segmentTournaments
          .filter((tournament) => tournament.season === latestSeason)
          .map((tournament) => tournament.id));
        // The default page shows the latest season. Don't submit a placeholder
        // just because a tournament row exists without any published matches.
        return matches.some((match) => visibleTournamentIds.has(match.tournamentId));
      })
      .map((segment) => ({
        url: `${baseUrl}/tournaments/${segment.key}`,
        changeFrequency: "daily" as const,
        priority: 0.75,
      }));

    // 챔피언 상세의 canonical과 같은 주소를 제출한다.
    const championRoutes = champions.map((champion) => ({
      url: `${baseUrl}/champions/${champion.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticRoutes, ...teamRoutes, ...fanTalkRoutes, ...fanTalkPostRoutes, ...playerRoutes, ...championRoutes, ...matchRoutes, ...tournamentRoutes];
  } catch {
    return staticRoutes;
  }
}

async function scheduledPreviewTimes(matchIds: string[]) {
  const times = new Map<string, string>();
  if (!matchIds.length) return times;
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("match_ai_previews")
      .select("match_id,generated_at")
      .in("match_id", matchIds)
      .not("generated_at", "is", null);
    if (error) return times;
    for (const row of data ?? []) times.set(row.match_id as string, row.generated_at as string);
  } catch {
    // 서비스 키가 없는 환경에서는 수정일 없이 제출한다.
  }
  return times;
}
