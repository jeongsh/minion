import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/api/mobile/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Accept, Authorization, Content-Type, X-Minion-Installation-Id" },
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
