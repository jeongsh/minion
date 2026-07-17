import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteBaseUrl();
  const now = new Date();
  const routes = [
    "",
    "/schedule",
    "/teams",
    "/players",
    "/tournaments",
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

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/polic") || route === "/privacy" || route === "/terms" || route === "/advertising" ? 0.3 : 0.8,
  }));
}
