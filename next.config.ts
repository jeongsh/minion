import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "10.0.2.2"],
  // Next streams metadata into <body> for Googlebot by default, and Google
  // ignores rel=canonical / robots outside <head>. Keep Next's default list
  // (next/dist/shared/lib/router/utils/html-bots.js) and add Googlebot so
  // search crawlers always receive metadata inside <head>.
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  experimental: {
    // On this Windows checkout the dev cache grew to 40 GB / 440k files,
    // with multi-second compactions during edits. Keep dev caching in memory.
    turbopackFileSystemCacheForDev: false,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.minion\\.fan" }],
        destination: "https://minion.fan/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/mobile/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Accept, Authorization, Content-Type, X-Minion-Installation-Id, Cache-Control, Pragma" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
  // Turbopack can externalize sharp without tracing its platform-specific
  // optional packages into every Server Action that references the shared
  // image helpers. Include both the app dependency and Next's nested copy so
  // Linux Functions always receive the native binding and libvips runtime.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/next/node_modules/sharp/**/*",
      "./node_modules/next/node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/next/node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
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
