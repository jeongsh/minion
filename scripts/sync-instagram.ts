import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import {
  getInstagramOwners,
  extractUsername,
  syncOwnerPosts,
} from "../lib/sync/instagram.ts";
import { fetchInstagramGraphPosts, instagramGraphCredentials, INSTAGRAM_GRAPH_USERNAMES } from "../lib/scraper/instagram-graph.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const modeArg = argv.find((a) => a.startsWith("--mode="))?.split("=", 2)[1] || "all";
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const offsetArg = parseInt(argv.find((a) => a.startsWith("--offset="))?.split("=", 2)[1] ?? "0");
const dryRun = argSet.has("--dry-run");
const noNotify = argSet.has("--no-notify");
const maxPosts = Number(argv.find((arg) => arg.startsWith("--max-posts="))?.slice("--max-posts=".length) ?? "60");

const DELAY_MS = 5000;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function main() {
  if (!Number.isInteger(maxPosts) || maxPosts < 1 || maxPosts > 500) {
    throw new Error("--max-posts must be an integer between 1 and 500.");
  }
  loadEnvFile();

  instagramGraphCredentials();
  if (argSet.has("--check-api")) {
    const username = argv.find((arg) => arg.startsWith("--username="))?.slice("--username=".length) ?? "t1lol";
    const posts = await fetchInstagramGraphPosts(username.toLowerCase(), 1);
    if (!posts.length) throw new Error("Official API check returned no media.");
    console.log(`[graph] @${username}: API check passed. No database writes or notifications.`);
    return;
  }
  if (!["all", "posts"].includes(modeArg) || argSet.has("--check-session")) throw new Error("Only official API post collection is supported.");
  console.log(`[mode] ${modeArg} / dryRun=${dryRun} / maxPosts=${maxPosts}`);

  const supabase = createSupabaseAdminClient();
  const allOwners = await getInstagramOwners(supabase);

  const kindFilter = onlyArg?.replace(/s$/, "");
  let owners = kindFilter ? allOwners.filter((o) => o.kind === kindFilter) : allOwners;
  if (owners.length === 0) throw new Error("No Instagram owners found.");
  const total = owners.length;
  owners = owners.filter((owner) => owner.instagramUrl && INSTAGRAM_GRAPH_USERNAMES.has(extractUsername(owner.instagramUrl).toLowerCase()));
  const unsupported = total - owners.length;
  console.log(`[graph] verified=${owners.length} unsupported_skipped=${unsupported}; no cookie/browser fallback`);
  if (offsetArg > 0) owners = owners.slice(offsetArg);
  if (limitArg > 0) owners = owners.slice(0, limitArg);

  console.log(
    `Found ${total} total — processing ${owners.length}` +
      (offsetArg > 0 ? ` (offset=${offsetArg})` : "") +
      (limitArg > 0 ? ` (limit=${limitArg})` : ""),
  );

  let postsInserted = 0;
  let errors = 0;
  let checked = 0;
  let healthyOwners = 0;
  let attemptedOwners = 0;
  let stoppedReason: string | null = null;

  for (const owner of owners) {
    if (!owner.instagramUrl) continue;

    // ── 게시물 ──
    if (modeArg === "all" || modeArg === "posts") {
      attemptedOwners += 1;
      try {
        const result = await syncOwnerPosts(supabase, owner, { dryRun, noNotify, maxPosts });
        postsInserted += result.inserted;
        checked += result.checked;
        healthyOwners += 1;
        console.log(`[posts] ${owner.kind}:${owner.name} — checked=${result.checked} new=${result.inserted}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors += 1;
        console.error(`[error] ${owner.kind}:${owner.name} posts — ${message}`);
        stoppedReason = message.startsWith("INSTAGRAM_GRAPH_STOP:") ? message : null;
        if (stoppedReason) {
          console.error(`[stopped] ${stoppedReason}`);
          break;
        }
      }
      await delay(DELAY_MS);
    }

  }

  const summary = `owners=${owners.length} attempted=${attemptedOwners} skipped=${owners.length - attemptedOwners} unsupported=${unsupported} healthy=${healthyOwners} checked=${checked} posts_new=${postsInserted} errors=${errors} dryRun=${dryRun}`;
  console.log(`\nDone. ${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Instagram collection\n\n${summary}\n\n${stoppedReason ?? "Collection finished."}\n`);


  if (errors > 0 || healthyOwners === 0 || checked === 0) {
    throw new Error(`Instagram sync unhealthy: healthy=${healthyOwners} checked=${checked} errors=${errors}`);
  }
}

main().catch((err) => {
  console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
