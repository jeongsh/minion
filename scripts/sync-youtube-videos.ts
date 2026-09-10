import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { notifyTeamContentUpdate } from "../lib/notifications/team-content.ts";
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
const noNotify = args.has("--no-notify");
const recent = args.has("--recent");

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
  if (owners.length === 0) throw new Error("No YouTube owners found; refusing to report an empty sync as healthy.");
  let inserted = 0;
  let checked = 0;
  let failed = 0;
  const entriesByChannel = new Map<string, Awaited<ReturnType<typeof fetchYoutubeVideoEntries>>>();
  const effectiveSince = recent ? new Date(Date.now() - 7 * 24 * 60 * 60_000) : since;
  if (!Number.isFinite(effectiveSince.getTime())) throw new Error("Invalid --since date");

  for (const owner of owners) {
    if (!owner.youtubeUrl) continue;

    try {
      const channelId = await resolveOwnerChannelId(supabase, owner);
      if (!channelId) {
        throw new Error("channel id not found");
      }

      let entries = entriesByChannel.get(channelId);
      if (!entries) {
        entries = await fetchYoutubeVideoEntries(channelId, { since: effectiveSince });
        entriesByChannel.set(channelId, entries);
      }
      checked += entries.length;

      for (const entry of entries) {
        const result = await upsertYoutubeVideo(supabase, owner, entry, { dryRun });
        if (result.inserted) {
          inserted += 1;
          console.log(`[new] ${owner.kind}:${owner.name} - ${result.title}`);
          if (!noNotify && owner.teamId && result.id) {
            await notifyTeamContentUpdate(supabase, {
              kind: "team_video",
              sourceId: result.id,
              teamId: owner.teamId,
              contentTitle: entry.title,
              imageUrl: entry.thumbnailUrl,
              publishedAt: entry.publishedAt,
            });
          }
        }
      }

      console.log(`[ok] ${owner.kind}:${owner.name} ${entries.length} videos since ${effectiveSince.toISOString()}`);
    } catch (error) {
      failed += 1;
      console.error(`[error] ${owner.kind}:${owner.name} ${(error as Error).message}`);
    }
  }

  console.log(`Done. owners=${owners.length} checked=${checked} new=${inserted} failed=${failed} dryRun=${dryRun}`);
  if (failed > 0) throw new Error(`YouTube sync failed for ${failed} owner(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
