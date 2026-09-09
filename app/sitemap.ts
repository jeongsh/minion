import type { MetadataRoute } from "next";
import { getMatches, getPlayers, getTeams, getTournaments } from "@/lib/data/lck";
import { siteBaseUrl } from "@/lib/site";
import { canQuerySupabase } from "@/lib/supabase/server";
import { DOMESTIC_SEGMENTS, INTERNATIONAL_SEGMENTS } from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl();
  // 실제 콘텐츠 수정 시각을 알 수 없는 URL은 lastModified를 생략한다.
  // 생성 시각이나 경기 예정일은 페이지의 최종 수정일이 아니다.
  const staticChangeFrequency = (route: string): MetadataRoute.Sitemap[number]["changeFrequency"] =>
    route === "" ? "daily" : "weekly";
  const routes = [
    "",
    "/schedule",
    "/teams",
    "/players",
    "/tournaments",
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

  try {
    const [teams, players, matches, tournaments] = await Promise.all([
      getTeams(),
      getPlayers(),
      getMatches(),
      getTournaments(),
    ]);

    const teamRoutes = teams.map((team) => ({
        url: `${baseUrl}/fan/${team.fanSiteHost}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));

    const playerRoutes = players.map((player) => ({
      url: `${baseUrl}/players/${player.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const matchRoutes = matches.map((match) => ({
      url: `${baseUrl}/matches/${match.id}`,
      changeFrequency: match.status === "scheduled" ? ("daily" as const) : ("monthly" as const),
      priority: match.status === "scheduled" ? 0.75 : 0.55,
    }));

    const tournamentRoutes = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS]
      .filter((segment) => tournaments.some((tournament) => matchesTournamentSegment(tournament, segment.key)))
      .map((segment) => ({
        url: `${baseUrl}/tournaments/${segment.key}`,
        changeFrequency: "daily" as const,
        priority: 0.75,
      }));

    return [...staticRoutes, ...teamRoutes, ...playerRoutes, ...matchRoutes, ...tournamentRoutes];
  } catch {
    return staticRoutes;
  }
}
