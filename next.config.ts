import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Game assets are already small, CDN-hosted icons. Sending them through
    // Vercel's optimizer creates a large number of low-value transformations
    // when crawlers traverse match and set pages.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
      },
      {
        protocol: "https",
        hostname: "raw.communitydragon.org",
      },
    ],
  },
};

export default nextConfig;
