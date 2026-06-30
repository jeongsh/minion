/**
 * [1회용] embed 렌더로 만료된 인스타 게시물 이미지를 복구한다.
 *
 * backfill/restore가 손대지 못하는 "만료된 CDN URL을 든 옛 게시물"이 대상이다.
 * (backfill은 만료 URL 다운로드에 실패하고, restore는 최근 프로필 스크랩 창에
 *  안 잡히는 옛 글엔 닿지 못한다.)
 *
 * embed 페이지(/p/{shortcode}/embed/)는 shortcode만 있으면 게시물 나이와
 * 무관하게 인스타가 메인 이미지를 렌더해 주므로, 실제 브라우저로 렌더한 뒤
 * 그 신선한 URL을 Storage(instagram-media)에 영구 저장하고 DB를 갱신한다.
 *
 * 대상: 컬럼이 채워져 있으나 아직 Storage URL이 아닌 행(= 만료 CDN URL).
 *
 * 사용법:
 *   npx tsx scripts/recover-instagram-embed-images.ts
 *   npx tsx scripts/recover-instagram-embed-images.ts --only=players
 *   npx tsx scripts/recover-instagram-embed-images.ts --only=teams
 *   npx tsx scripts/recover-instagram-embed-images.ts --limit=50 --offset=0
 *   npx tsx scripts/recover-instagram-embed-images.ts --dry-run
 *
 * 환경변수:
 *   SUPABASE_SERVICE_ROLE_KEY (필수)
 *   INSTAGRAM_SESSION_COOKIE  (선택) - embed는 비로그인도 동작하나 있으면 사용
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import {
  INSTAGRAM_MEDIA_BUCKET,
  extractShortcode,
  storeInstagramImage,
} from "../lib/sync/instagram.ts";
import {
  createEmbedImageScraper,
  closeBrowser,
} from "../lib/scraper/instagram-browser.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const offsetArg = parseInt(argv.find((a) => a.startsWith("--offset="))?.split("=", 2)[1] ?? "0");
const delayArg = parseInt(argv.find((a) => a.startsWith("--delay="))?.split("=", 2)[1] ?? "1200");
const dryRun = argSet.has("--dry-run");

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

type Row = { id: string; source_url: string };

async function recoverTable(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  scraper: Awaited<ReturnType<typeof createEmbedImageScraper>>,
  table: "player_social_posts" | "team_social_posts",
  column: "image_url" | "thumbnail_url",
  keyPrefix: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("id, source_url")
    .eq("platform", "instagram")
    .not(column, "is", null)
    .neq(column, "")
    .not(column, "ilike", `%${INSTAGRAM_MEDIA_BUCKET}%`)
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  let rows = (data ?? []) as Row[];
  if (offsetArg > 0) rows = rows.slice(offsetArg);
  if (limitArg > 0) rows = rows.slice(0, limitArg);

  console.log(`[${table}] 대상 ${rows.length}건`);

  let recovered = 0;
  let noImage = 0;
  let noShortcode = 0;
  for (const row of rows) {
    const shortcode = extractShortcode(row.source_url);
    if (!shortcode) {
      noShortcode += 1;
      continue;
    }

    const freshUrl = await scraper.fetch(shortcode);
    if (!freshUrl) {
      noImage += 1;
      console.log(`  [skip] ${shortcode} — embed 이미지 없음(삭제·비공개 가능)`);
      await delay(delayArg);
      continue;
    }

    if (dryRun) {
      recovered += 1;
      console.log(`  [dry] ${shortcode} → ${freshUrl.slice(0, 70)}…`);
      await delay(delayArg);
      continue;
    }

    const stored = await storeInstagramImage(
      supabase,
      `${keyPrefix}_${shortcode}`,
      freshUrl,
    );
    if (!stored) {
      noImage += 1;
      console.log(`  [skip] ${shortcode} — 저장 실패`);
    } else {
      const { error: updErr } = await supabase
        .from(table)
        .update({ [column]: stored })
        .eq("id", row.id);
      if (updErr) throw updErr;
      recovered += 1;
      console.log(`  [ok]   ${shortcode}`);
    }
    await delay(delayArg);
  }

  console.log(
    `[${table}] 복구 ${recovered}건 / 이미지없음·실패 ${noImage}건 / shortcode없음 ${noShortcode}건`,
  );
  return { recovered, noImage, noShortcode };
}

async function main() {
  loadEnvFile();

  const sessionCookie = process.env.INSTAGRAM_SESSION_COOKIE?.trim();
  console.log(
    sessionCookie
      ? "[browser] Instagram session cookie loaded"
      : "[browser] 세션 쿠키 없음 — embed는 비로그인으로 동작",
  );
  console.log(
    `[mode] dryRun=${dryRun}${onlyArg ? ` only=${onlyArg}` : ""}${limitArg ? ` limit=${limitArg}` : ""}${offsetArg ? ` offset=${offsetArg}` : ""} delay=${delayArg}ms`,
  );

  const supabase = createSupabaseAdminClient();
  const scraper = await createEmbedImageScraper(sessionCookie);

  try {
    if (!onlyArg || onlyArg === "players") {
      await recoverTable(supabase, scraper, "player_social_posts", "image_url", "player");
    }
    if (!onlyArg || onlyArg === "teams") {
      await recoverTable(supabase, scraper, "team_social_posts", "thumbnail_url", "team");
    }
  } finally {
    await scraper.close();
    await closeBrowser();
  }

  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err);
  await closeBrowser();
  process.exit(1);
});
