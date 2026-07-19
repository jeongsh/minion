import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/lab/", "/login", "/logout", "/me", "/signup", "/forgot-password", "/reset-password"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
