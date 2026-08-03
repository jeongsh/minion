import type { MetadataRoute } from "next";
import { getMatches, getPlayers, getTeams } from "@/lib/data/lck";
import { getWeeklyReportIndex } from "@/lib/reports/queries";
import { siteBaseUrl } from "@/lib/site";
import { canQuerySupabase } from "@/lib/supabase/server";

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
    "/about",
  ];

  const staticRoutes = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: staticChangeFrequency(route),
    priority: route === "" ? 1 : route.startsWith("/polic") || route === "/privacy" || route === "/terms" || route === "/advertising" ? 0.3 : 0.8,
  }));

  if (!canQuerySupabase()) return staticRoutes;

  try {
    const [teams, players, matches, reports] = await Promise.all([
      getTeams(),
      getPlayers(),
      getMatches(),
      getWeeklyReportIndex(),
    ]);

    const teamRoutes = teams.flatMap((team) => [
      {
        url: `${baseUrl}/teams/${team.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      },
      {
        url: `${baseUrl}/fan/${team.fanSiteHost}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      },
    ]);

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

    return [...staticRoutes, ...teamRoutes, ...playerRoutes, ...matchRoutes, ...reportRoutes];
  } catch {
    return staticRoutes;
  }
}
