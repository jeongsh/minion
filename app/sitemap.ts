import type { MetadataRoute } from "next";
import { getMatches, getPlayers, getTeams, getTournaments } from "@/lib/data/lck";
import { getWeeklyReportIndex } from "@/lib/reports/queries";
import { siteBaseUrl } from "@/lib/site";
import { canQuerySupabase } from "@/lib/supabase/server";
import { DOMESTIC_SEGMENTS, INTERNATIONAL_SEGMENTS } from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl();
  const now = new Date();
  const staticChangeFrequency = (route: string): MetadataRoute.Sitemap[number]["changeFrequency"] =>
    route === "" ? "daily" : "weekly";
  const routes = [
    "",
    "/schedule",
    "/teams",
    "/players",
    "/tournaments",
    "/news",
    "/records",
    "/reports",
    "/community",
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
    lastModified: now,
    changeFrequency: staticChangeFrequency(route),
    priority: route === "" ? 1 : route.startsWith("/polic") || route === "/privacy" || route === "/terms" || route === "/advertising" || route === "/support" ? 0.3 : 0.8,
  }));

  if (!canQuerySupabase()) return staticRoutes;

  try {
    const [teams, players, matches, reports, tournaments] = await Promise.all([
      getTeams(),
      getPlayers(),
      getMatches(),
      getWeeklyReportIndex(),
      getTournaments(),
    ]);

    const teamRoutes = teams.map((team) => ({
        url: `${baseUrl}/fan/${team.fanSiteHost}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));

    const playerRoutes = players.map((player) => ({
      url: `${baseUrl}/players/${player.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const matchRoutes = matches.map((match) => ({
      url: `${baseUrl}/matches/${match.id}`,
      lastModified: new Date(match.matchDate),
      changeFrequency: match.status === "scheduled" ? ("daily" as const) : ("monthly" as const),
      priority: match.status === "scheduled" ? 0.75 : 0.55,
    }));

    const reportRoutes = reports.map((report) => ({
      url: `${baseUrl}/reports/${report.week_key}`,
      lastModified: new Date(report.period_end),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    }));

    const tournamentRoutes = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS]
      .filter((segment) => tournaments.some((tournament) => matchesTournamentSegment(tournament, segment.key)))
      .map((segment) => ({
        url: `${baseUrl}/tournaments/${segment.key}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.75,
      }));

    return [...staticRoutes, ...teamRoutes, ...playerRoutes, ...matchRoutes, ...reportRoutes, ...tournamentRoutes];
  } catch {
    return staticRoutes;
  }
}
