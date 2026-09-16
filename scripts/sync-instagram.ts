/**
 * 선수/팀의 인스타그램 게시물 + 스토리를 Playwright 브라우저로 가져와 DB에 저장합니다.
 *
 * 사용법:
 *   npx tsx scripts/sync-instagram.ts
 *   npx tsx scripts/sync-instagram.ts --only=players
 *   npx tsx scripts/sync-instagram.ts --only=teams
 *   npx tsx scripts/sync-instagram.ts --limit=20 --offset=0
 *   npx tsx scripts/sync-instagram.ts --mode=posts     # 게시물만
 *   npx tsx scripts/sync-instagram.ts --mode=stories   # 스토리만
 *   npx tsx scripts/sync-instagram.ts --dry-run
 *   npx tsx scripts/sync-instagram.ts --check-session --username=t1lol
 *
 * 환경변수:
 *   INSTAGRAM_SESSION_COOKIE  (권장) - 로그인 세션 쿠키
 */

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import {
  getInstagramOwners,
  syncOwnerPosts,
} from "../lib/sync/instagram.ts";
import { closeBrowser, scrapeInstagramPosts } from "../lib/scraper/instagram-browser.ts";
import { instagramFailureKind, instagramStopReason } from "../lib/scraper/instagram-failure.ts";
import { parseInstagramCookie } from "../lib/scraper/instagram-cookie.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const modeArg = argv.find((a) => a.startsWith("--mode="))?.split("=", 2)[1] || "all";
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const offsetArg = parseInt(argv.find((a) => a.startsWith("--offset="))?.split("=", 2)[1] ?? "0");
const dryRun = argSet.has("--dry-run");
const noNotify = argSet.has("--no-notify");

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
  loadEnvFile();

  const sessionCookie = process.env.INSTAGRAM_SESSION_COOKIE?.trim();
  if (sessionCookie) parseInstagramCookie(sessionCookie);
  if (argSet.has("--check-session")) {
    const username = argv.find((arg) => arg.startsWith("--username="))?.slice("--username=".length) ?? "t1lol";
    if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) throw new Error("Invalid Instagram username.");
    if (!sessionCookie) throw new Error("INSTAGRAM_SESSION_COOKIE is missing; add the refreshed session before checking.");
    console.log("[session] Cookie format valid; non-empty sessionid present. Values are not logged.");
    const posts = await scrapeInstagramPosts(username, sessionCookie, 12, { allowPublicFallback: false });
    if (posts.length === 0) throw new Error("Instagram session check inconclusive: no readable posts.");
    const summary = `Instagram saved-session check passed: @${username}, checked=${posts.length}. No posts saved or notifications sent.`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    await closeBrowser();
    return;
  }
  if (sessionCookie) console.log(`[browser] Instagram session cookie loaded`);
  else console.log(`[browser] INSTAGRAM_SESSION_COOKIE 없음 — 비로그인 공개 프로필 수집`);

  console.log(`[mode] ${modeArg} / dryRun=${dryRun}`);

  const supabase = createSupabaseAdminClient();
  const allOwners = await getInstagramOwners(supabase);

  const kindFilter = onlyArg?.replace(/s$/, "");
  let owners = kindFilter ? allOwners.filter((o) => o.kind === kindFilter) : allOwners;
  if (owners.length === 0) throw new Error("No Instagram owners found.");
  const total = owners.length;
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
  let consecutiveAccessFailures = 0;
  let stoppedReason: string | null = null;

  for (const owner of owners) {
    if (!owner.instagramUrl) continue;

    // ── 게시물 ──
    if (modeArg === "all" || modeArg === "posts") {
      attemptedOwners += 1;
      try {
        const result = await syncOwnerPosts(supabase, owner, { dryRun, sessionCookie, noNotify });
        postsInserted += result.inserted;
        checked += result.checked;
        healthyOwners += 1;
        consecutiveAccessFailures = 0;
        console.log(`[posts] ${owner.kind}:${owner.name} — checked=${result.checked} new=${result.inserted}`);
      } catch (err) {
        errors += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[error] ${owner.kind}:${owner.name} posts — ${message}`);
        consecutiveAccessFailures = instagramFailureKind(message) === "access" ? consecutiveAccessFailures + 1 : 0;
        stoppedReason = instagramStopReason(message, consecutiveAccessFailures);
        if (stoppedReason) {
          console.error(`[stopped] ${stoppedReason}`);
          break;
        }
      }
      await delay(DELAY_MS);
    }

    // ── 스토리 (비활성화) ──
    // if (modeArg === "all" || modeArg === "stories") {
    //   try {
    //     const result = await syncOwnerStories(supabase, owner, { dryRun, sessionCookie });
    //     storiesInserted += result.inserted;
    //     if (result.newStories.length > 0) {
    //       newStoryMap.push({ owner, stories: result.newStories });
    //     }
    //     console.log(
    //       `[stories] ${owner.kind}:${owner.name} — checked=${result.checked} new=${result.newStories.length} updated=${result.inserted}`,
    //     );
    //   } catch (err) {
    //     errors += 1;
    //     console.error(`[error] ${owner.kind}:${owner.name} stories — ${(err as Error).message}`);
    //   }
    //   await delay(DELAY_MS);
    // }
  }

  const summary = `owners=${owners.length} attempted=${attemptedOwners} skipped=${owners.length - attemptedOwners} healthy=${healthyOwners} checked=${checked} posts_new=${postsInserted} errors=${errors} dryRun=${dryRun}`;
  console.log(`\nDone. ${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Instagram collection\n\n${summary}\n\n${stoppedReason ?? "Collection finished."}\n`);

  // Discord 알림 (스토리 비활성화로 미사용)
  // const discordWebhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  // if (discordWebhook && newStoryMap.length > 0 && !dryRun) {
  //   console.log(`[discord] 새 스토리 알림 발송 (${newStoryMap.length}명)`);
  //   await sendDiscordStoryAlert(
  //     discordWebhook,
  //     newStoryMap.map(({ owner, stories }) => ({
  //       ownerName: owner.name,
  //       ownerKind: owner.kind,
  //       instagramUrl: owner.instagramUrl ?? "",
  //       newCount: stories.length,
  //       thumbnailUrl: stories.find((s) => s.thumbnailUrl ?? s.mediaType === "image")
  //         ?.thumbnailUrl ?? stories[0]?.mediaUrl,
  //     })),
  //   );
  // }

  await closeBrowser();
  if (errors > 0 || healthyOwners === 0 || checked === 0) {
    throw new Error(`Instagram sync unhealthy: healthy=${healthyOwners} checked=${checked} errors=${errors}`);
  }
}

main().catch(async (err) => {
  console.error(err);
  await closeBrowser();
  process.exit(1);
});
