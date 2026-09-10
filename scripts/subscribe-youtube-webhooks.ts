import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { youtubeWebsubTopicUrl } from "../lib/youtube-feed.ts";
import { getYoutubeVideoOwners, resolveOwnerChannelId } from "../lib/sync/youtube-videos.ts";
import { retryFetch } from "../lib/sync/retry-fetch.ts";

const HUB_URL = "https://pubsubhubbub.appspot.com/subscribe";
const args = new Set(process.argv.slice(2));
const unsubscribe = args.has("--unsubscribe");

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

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function subscribeTopic(callbackUrl: string, topicUrl: string) {
  const body = new URLSearchParams({
    "hub.mode": unsubscribe ? "unsubscribe" : "subscribe",
    "hub.callback": callbackUrl,
    "hub.topic": topicUrl,
  });

  const response = await retryFetch(HUB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }, { timeoutMs: 25_000 });

  if (!response.ok) {
    throw new Error(`Hub ${response.status}: ${await response.text()}`);
  }
}

async function main() {
  loadEnvFile();

  const callbackUrl = requireEnv("YOUTUBE_WEBHOOK_CALLBACK_URL");
  if (!callbackUrl.startsWith("https://")) {
    throw new Error("YOUTUBE_WEBHOOK_CALLBACK_URL must be a public HTTPS URL.");
  }

  const supabase = createSupabaseAdminClient();
  const owners = await getYoutubeVideoOwners(supabase);
  if (owners.length === 0) throw new Error("No YouTube owners found.");
  let subscribed = 0;
  let skipped = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  const subscribedChannels = new Set<string>();

  for (const owner of owners) {
    try {
      const channelId = await resolveOwnerChannelId(supabase, owner);
      if (!channelId) {
        throw new Error("channel id not found");
      }
      if (subscribedChannels.has(channelId)) { skipped += 1; continue; }

      const topicUrl = youtubeWebsubTopicUrl(channelId);
      await subscribeTopic(callbackUrl, topicUrl);
      subscribed += 1;
      subscribedChannels.add(channelId);
      consecutiveFailures = 0;
      console.log(
        `[ok] ${unsubscribe ? "unsubscribed" : "subscribed"} ${owner.kind}:${owner.name} ${topicUrl}`,
      );
    } catch (error) {
      failed += 1;
      consecutiveFailures += 1;
      console.error(`[error] ${owner.kind}:${owner.name} ${(error as Error).message}`);
      if (consecutiveFailures >= 3) {
        throw new Error("Three consecutive WebSub renewals failed; stopping this run. API polling continues independently.");
      }
    }
  }

  console.log(`Done. ${unsubscribe ? "unsubscribed" : "subscribed"}=${subscribed} skipped=${skipped} failed=${failed}`);
  if (failed > 0) {
    throw new Error(`YouTube WebSub ${unsubscribe ? "unsubscribe" : "renewal"} failed for ${failed} channel(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
