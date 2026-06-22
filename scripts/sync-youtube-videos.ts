import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { fetchYoutubeVideoEntries } from "../lib/youtube-feed.ts";
import {
  getYoutubeVideoOwners,
  resolveOwnerChannelId,
  upsertYoutubeVideo,
} from "../lib/sync/youtube-videos.ts";

const args = new Set(process.argv.slice(2));
const sinceArg = process.argv.find((arg) => arg.startsWith("--since="))?.split("=", 2)[1];
const since = new Date(sinceArg ?? "2026-01-01T00:00:00.000Z");
const dryRun = args.has("--dry-run");

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // .env.local is optional when env vars are already set.
  }
}

async function main() {
  loadEnvFile();

  const supabase = createSupabaseAdminClient();
  const owners = await getYoutubeVideoOwners(supabase);
  let inserted = 0;
  let checked = 0;

  for (const owner of owners) {
    if (!owner.youtubeUrl) continue;

    try {
      const channelId = await resolveOwnerChannelId(supabase, owner);
      if (!channelId) {
        console.log(`[skip] ${owner.kind}:${owner.name} channel id not found`);
        continue;
      }

      const entries = await fetchYoutubeVideoEntries(channelId, { since });
      checked += entries.length;

      for (const entry of entries) {
        const result = await upsertYoutubeVideo(supabase, owner, entry, { dryRun });
        if (result.inserted) {
          inserted += 1;
          console.log(`[new] ${owner.kind}:${owner.name} - ${result.title}`);
        }
      }

      console.log(`[ok] ${owner.kind}:${owner.name} ${entries.length} videos since ${since.toISOString()}`);
    } catch (error) {
      console.error(`[error] ${owner.kind}:${owner.name} ${(error as Error).message}`);
    }
  }

  console.log(`Done. checked=${checked} new=${inserted} dryRun=${dryRun}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
