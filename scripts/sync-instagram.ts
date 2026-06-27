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
 *
 * 환경변수:
 *   INSTAGRAM_SESSION_COOKIE  (권장) - 로그인 세션 쿠키
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import {
  getInstagramOwners,
  syncOwnerPosts,
} from "../lib/sync/instagram.ts";
import { closeBrowser } from "../lib/scraper/instagram-browser.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const modeArg = argv.find((a) => a.startsWith("--mode="))?.split("=", 2)[1] || "all";
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const offsetArg = parseInt(argv.find((a) => a.startsWith("--offset="))?.split("=", 2)[1] ?? "0");
const dryRun = argSet.has("--dry-run");

const DELAY_MS = 1500;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    // optional
  }
}

async function main() {
  loadEnvFile();

  const sessionCookie = process.env.INSTAGRAM_SESSION_COOKIE?.trim();
  if (sessionCookie) console.log(`[browser] Instagram session cookie loaded`);
  else console.log(`[browser] INSTAGRAM_SESSION_COOKIE 없음 — 게시물만 수집 (스토리 스킵)`);

  console.log(`[mode] ${modeArg} / dryRun=${dryRun}`);

  const supabase = createSupabaseAdminClient();
  const allOwners = await getInstagramOwners(supabase);

  const kindFilter = onlyArg?.replace(/s$/, "");
  let owners = kindFilter ? allOwners.filter((o) => o.kind === kindFilter) : allOwners;
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

  for (const owner of owners) {
    if (!owner.instagramUrl) continue;

    // ── 게시물 ──
    if (modeArg === "all" || modeArg === "posts") {
      try {
        const result = await syncOwnerPosts(supabase, owner, { dryRun, sessionCookie });
        postsInserted += result.inserted;
        console.log(`[posts] ${owner.kind}:${owner.name} — checked=${result.checked} new=${result.inserted}`);
      } catch (err) {
        errors += 1;
        console.error(`[error] ${owner.kind}:${owner.name} posts — ${(err as Error).message}`);
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

  console.log(
    `\nDone. posts_new=${postsInserted} errors=${errors} dryRun=${dryRun}`,
  );

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
}

main().catch(async (err) => {
  console.error(err);
  await closeBrowser();
  process.exit(1);
});
