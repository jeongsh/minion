/**
 * 선수/팀의 인스타그램 게시물 + 스토리를 RapidAPI로 가져와 DB에 저장합니다.
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
 *   RAPIDAPI_KEY  (필수) - RapidAPI 키
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import {
  getInstagramOwners,
  syncOwnerPosts,
  syncOwnerStories,
  type SyncEngine,
} from "../lib/sync/instagram.ts";
import { closeBrowser } from "../lib/scraper/instagram-browser.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const modeArg = argv.find((a) => a.startsWith("--mode="))?.split("=", 2)[1] || "all";
const engineArg = (argv.find((a) => a.startsWith("--engine="))?.split("=", 2)[1] || "auto") as SyncEngine;
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const offsetArg = parseInt(argv.find((a) => a.startsWith("--offset="))?.split("=", 2)[1] ?? "0");
const dryRun = argSet.has("--dry-run");

const DELAY_MS = 1500; // RapidAPI는 직접 스크래핑보다 Rate Limit 여유 있음
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

  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) {
    console.error("[error] RAPIDAPI_KEY 환경변수가 없습니다.");
    process.exit(1);
  }
  const sessionCookie = process.env.INSTAGRAM_SESSION_COOKIE?.trim();

  console.log(`[engine] ${engineArg}`);
  if (apiKey) console.log(`[rapidapi] key loaded (${apiKey.slice(0, 8)}...)`);
  if (sessionCookie) console.log(`[browser] Instagram session cookie loaded`);
  if (engineArg !== "rapidapi" && !sessionCookie) {
    console.warn("[warn] INSTAGRAM_SESSION_COOKIE 없음 — 스토리 수집 불가, 게시물은 비로그인 시도");
  }
  console.log(`[mode] ${modeArg} / dryRun=${dryRun}`);

  const supabase = createSupabaseAdminClient();
  const allOwners = await getInstagramOwners(supabase);

  // "players"→"player", "teams"→"team" 모두 허용
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
  let storiesInserted = 0;
  let errors = 0;

  for (const owner of owners) {
    if (!owner.instagramUrl) continue;

    // ── 게시물 ──
    if (modeArg === "all" || modeArg === "posts") {
      try {
        const result = await syncOwnerPosts(supabase, owner, { dryRun, engine: engineArg, sessionCookie });
        postsInserted += result.inserted;
        console.log(
          `[posts] ${owner.kind}:${owner.name} — checked=${result.checked} new=${result.inserted}`,
        );
      } catch (err) {
        errors += 1;
        console.error(`[error] ${owner.kind}:${owner.name} posts — ${(err as Error).message}`);
      }
      await delay(DELAY_MS);
    }

    // ── 스토리 ──
    if (modeArg === "all" || modeArg === "stories") {
      try {
        const result = await syncOwnerStories(supabase, owner, { dryRun, engine: engineArg, sessionCookie });
        storiesInserted += result.inserted;
        console.log(
          `[stories] ${owner.kind}:${owner.name} — checked=${result.checked} new/updated=${result.inserted}`,
        );
      } catch (err) {
        errors += 1;
        console.error(`[error] ${owner.kind}:${owner.name} stories — ${(err as Error).message}`);
      }
      await delay(DELAY_MS);
    }
  }

  console.log(
    `\nDone. posts_new=${postsInserted} stories_upserted=${storiesInserted} errors=${errors} dryRun=${dryRun}`,
  );

  // Playwright 브라우저 종료
  if (engineArg !== "rapidapi") {
    await closeBrowser();
  }
}

main().catch(async (err) => {
  console.error(err);
  await closeBrowser();
  process.exit(1);
});
