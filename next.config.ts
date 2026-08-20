import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
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
