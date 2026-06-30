/**
 * 기존 인스타그램 게시물 이미지를 Supabase Storage(instagram-media)로 이관한다.
 * 인스타 CDN URL은 만료형이라, 아직 유효한 URL만 영구 저장으로 옮길 수 있다.
 * (이미 만료된 항목은 다음 동기화에서 새 URL을 받아 저장된다.)
 *
 * 사용법:
 *   npx tsx scripts/backfill-instagram-images.ts
 *   npx tsx scripts/backfill-instagram-images.ts --only=players
 *   npx tsx scripts/backfill-instagram-images.ts --only=teams
 *   npx tsx scripts/backfill-instagram-images.ts --limit=100
 *   npx tsx scripts/backfill-instagram-images.ts --dry-run
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { INSTAGRAM_MEDIA_BUCKET, storeInstagramImage } from "../lib/sync/instagram.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const dryRun = argSet.has("--dry-run");

const DELAY_MS = 300;
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

type Row = { id: string; url: string };

async function backfillTable(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: "player_social_posts" | "team_social_posts",
  column: "image_url" | "thumbnail_url",
  keyPrefix: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select(`id, ${column}`)
    .eq("platform", "instagram")
    .not(column, "is", null)
    .not(column, "ilike", `%${INSTAGRAM_MEDIA_BUCKET}%`)
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  const records = (data ?? []) as Array<Record<string, unknown>>;
  let rows: Row[] = records
    .map((r) => ({ id: String(r.id), url: String(r[column] ?? "") }))
    .filter((r) => r.url);
  if (limitArg > 0) rows = rows.slice(0, limitArg);

  console.log(`[${table}] 대상 ${rows.length}건`);

  let migrated = 0;
  let expired = 0;
  for (const row of rows) {
    if (dryRun) continue;

    const stored = await storeInstagramImage(supabase, `${keyPrefix}_${row.id}`, row.url);
    if (!stored) {
      expired += 1;
      continue;
    }
    if (stored !== row.url) {
      const { error: updErr } = await supabase.from(table).update({ [column]: stored }).eq("id", row.id);
      if (updErr) throw updErr;
      migrated += 1;
    }
    await delay(DELAY_MS);
  }

  console.log(`[${table}] 이관 ${migrated}건 / 만료·실패 ${expired}건`);
  return { migrated, expired };
}

async function main() {
  loadEnvFile();
  const supabase = createSupabaseAdminClient();

  console.log(`[mode] dryRun=${dryRun}${onlyArg ? ` only=${onlyArg}` : ""}${limitArg ? ` limit=${limitArg}` : ""}`);

  if (!onlyArg || onlyArg === "players") {
    await backfillTable(supabase, "player_social_posts", "image_url", "player");
  }
  if (!onlyArg || onlyArg === "teams") {
    await backfillTable(supabase, "team_social_posts", "thumbnail_url", "team");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
