/**
 * [1회용] 인스타 프로필을 새로 스크랩해, DB에 이미 있는 게시물 중
 * 아직 Storage(instagram-media)에 저장되지 않은 이미지를 신선한 URL로 채워넣는다.
 *
 * 기존 backfill 스크립트는 DB에 저장된 (이미 만료됐을 수 있는) URL을 그대로 쓰지만,
 * 이 스크립트는 프로필을 다시 긁어 신선한 CDN URL을 받으므로 만료된 항목도 복구된다.
 * (단, 프로필에서 이미 사라진 옛 게시물은 새로 긁을 수 없어 복구 불가.)
 *
 * 사용법:
 *   npx tsx scripts/restore-instagram-images.ts
 *   npx tsx scripts/restore-instagram-images.ts --only=players
 *   npx tsx scripts/restore-instagram-images.ts --only=teams
 *   npx tsx scripts/restore-instagram-images.ts --limit=20 --offset=0
 *   npx tsx scripts/restore-instagram-images.ts --dry-run
 *
 * 환경변수:
 *   INSTAGRAM_SESSION_COOKIE  (권장) - 로그인 세션 쿠키
 *   SUPABASE_SERVICE_ROLE_KEY (필수)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { getInstagramOwners, restoreOwnerImages } from "../lib/sync/instagram.ts";
import { closeBrowser } from "../lib/scraper/instagram-browser.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
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
  else console.log(`[browser] INSTAGRAM_SESSION_COOKIE 없음 — 공개 게시물만 스크랩`);

  console.log(`[mode] dryRun=${dryRun}${onlyArg ? ` only=${onlyArg}` : ""}${limitArg ? ` limit=${limitArg}` : ""}`);

  const supabase = createSupabaseAdminClient();
  const allOwners = await getInstagramOwners(supabase);

  const kindFilter = onlyArg?.replace(/s$/, "");
  let owners = kindFilter ? allOwners.filter((o) => o.kind === kindFilter) : allOwners;
  const total = owners.length;
  if (offsetArg > 0) owners = owners.slice(offsetArg);
  if (limitArg > 0) owners = owners.slice(0, limitArg);

  console.log(`Found ${total} total — processing ${owners.length}`);

  let restoredTotal = 0;
  let errors = 0;

  for (const owner of owners) {
    if (!owner.instagramUrl) continue;
    try {
      const result = await restoreOwnerImages(supabase, owner, { dryRun, sessionCookie });
      restoredTotal += result.restored;
      console.log(
        `[restore] ${owner.kind}:${owner.name} — scraped=${result.checked} restored=${result.restored} (db에없음=${result.missingInDb})`,
      );
    } catch (err) {
      errors += 1;
      console.error(`[error] ${owner.kind}:${owner.name} — ${(err as Error).message}`);
    }
    await delay(DELAY_MS);
  }

  console.log(`\nDone. restored=${restoredTotal} errors=${errors} dryRun=${dryRun}`);

  await closeBrowser();
}

main().catch(async (err) => {
  console.error(err);
  await closeBrowser();
  process.exit(1);
});
