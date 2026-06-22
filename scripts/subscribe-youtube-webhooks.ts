import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { youtubeFeedUrl } from "../lib/youtube-feed.ts";
import { getYoutubeVideoOwners, resolveOwnerChannelId } from "../lib/sync/youtube-videos.ts";

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

  const response = await fetch(HUB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

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
  let subscribed = 0;
  let skipped = 0;

  for (const owner of owners) {
    try {
      const channelId = await resolveOwnerChannelId(supabase, owner);
      if (!channelId) {
        skipped += 1;
        console.log(`[skip] ${owner.kind}:${owner.name} channel id not found`);
        continue;
      }

      await subscribeTopic(callbackUrl, youtubeFeedUrl(channelId));
      subscribed += 1;
      console.log(`[ok] ${unsubscribe ? "unsubscribed" : "subscribed"} ${owner.kind}:${owner.name}`);
    } catch (error) {
      skipped += 1;
      console.error(`[error] ${owner.kind}:${owner.name} ${(error as Error).message}`);
    }
  }

  console.log(`Done. ${unsubscribe ? "unsubscribed" : "subscribed"}=${subscribed} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
