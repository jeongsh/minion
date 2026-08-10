/**
 * 기존에 Supabase Storage(instagram-media)에 저장된 이미지를 Cloudflare R2로 옮기고
 * DB의 image_url/thumbnail_url을 새 R2 공개 URL로 갱신한다.
 * R2_* 환경변수(계정/버킷/커스텀 도메인)가 채워진 뒤에만 실행할 수 있다.
 *
 * 사용법:
 *   npx tsx scripts/migrate-instagram-media-to-r2.ts
 *   npx tsx scripts/migrate-instagram-media-to-r2.ts --only=players
 *   npx tsx scripts/migrate-instagram-media-to-r2.ts --only=teams
 *   npx tsx scripts/migrate-instagram-media-to-r2.ts --limit=50
 *   npx tsx scripts/migrate-instagram-media-to-r2.ts --dry-run
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { INSTAGRAM_MEDIA_BUCKET } from "../lib/sync/instagram.ts";
import { uploadToR2 } from "../lib/storage/r2.ts";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const onlyArg = argv.find((a) => a.startsWith("--only="))?.split("=", 2)[1] || undefined;
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");
const dryRun = argSet.has("--dry-run");

const BATCH_SIZE = 20;

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

/** Supabase Storage 공개 URL에서 버킷 내부 path(예: posts/xxx.webp)를 뽑는다. */
function extractStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${INSTAGRAM_MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

function guessContentType(path: string): string {
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

type Row = { id: string; url: string };

/**
 * 이미 옮긴 행은 이 필터(아직 Supabase Storage URL)에서 자연히 빠지므로,
 * PostgREST 기본 페이지 크기(1000)에 걸리지 않도록 결과가 빌 때까지 반복 조회한다.
 */
async function fetchPendingRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: "player_social_posts" | "team_social_posts",
  column: "image_url" | "thumbnail_url",
  orderColumn: "posted_at" | "published_at",
): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select(`id, ${column}`)
    .not(column, "is", null)
    .ilike(column, `%/storage/v1/object/public/${INSTAGRAM_MEDIA_BUCKET}/%`)
    .order(orderColumn, { ascending: false, nullsFirst: false });
  if (error) throw error;

  const records = (data ?? []) as Array<Record<string, unknown>>;
  return records.map((r) => ({ id: String(r.id), url: String(r[column] ?? "") })).filter((r) => r.url);
}

async function migrateTable(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: "player_social_posts" | "team_social_posts",
  column: "image_url" | "thumbnail_url",
  orderColumn: "posted_at" | "published_at",
) {
  let totalMigrated = 0;
  let totalFailed = 0;

  for (;;) {
    const rows = await fetchPendingRows(supabase, table, column, orderColumn);
    if (rows.length === 0) break;

    console.log(`[${table}] 대상 ${rows.length}건 (누적 처리 ${totalMigrated}건)`);
    const { migrated, failed } = await migrateBatch(supabase, table, column, rows);
    totalMigrated += migrated;
    totalFailed += failed;

    if (dryRun) break; // dry-run은 실제 이관을 안 하므로 무한 루프 방지
    if (limitArg > 0 && totalMigrated >= limitArg) break;
  }

  console.log(`[${table}] 이관 ${totalMigrated}건 / 실패 ${totalFailed}건`);
  return { migrated: totalMigrated, failed: totalFailed };
}

async function migrateBatch(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: "player_social_posts" | "team_social_posts",
  column: "image_url" | "thumbnail_url",
  rowsIn: Row[],
) {
  const rows = limitArg > 0 ? rowsIn.slice(0, limitArg) : rowsIn;

  let migrated = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        const path = extractStoragePath(row.url);
        if (!path) {
          failed += 1;
          console.error(`  [skip] ${row.id} — path 파싱 실패: ${row.url}`);
          return;
        }
        if (dryRun) {
          migrated += 1;
          return;
        }

        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(INSTAGRAM_MEDIA_BUCKET)
            .download(path);
          if (dlErr || !blob) throw dlErr ?? new Error("empty download");

          const bytes = Buffer.from(await blob.arrayBuffer());
          const contentType = blob.type || guessContentType(path);
          const newUrl = await uploadToR2(path, bytes, contentType);

          const { error: updErr } = await supabase.from(table).update({ [column]: newUrl }).eq("id", row.id);
          if (updErr) throw updErr;

          migrated += 1;
        } catch (err) {
          failed += 1;
          console.error(`  [fail] ${row.id} (${path}):`, err instanceof Error ? err.message : err);
        }
      }),
    );
    console.log(`  ...${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log(`[${table}] 이관 ${migrated}건 / 실패 ${failed}건`);
  return { migrated, failed };
}

async function main() {
  loadEnvFile();
  const supabase = createSupabaseAdminClient();

  console.log(`[mode] dryRun=${dryRun}${onlyArg ? ` only=${onlyArg}` : ""}${limitArg ? ` limit=${limitArg}` : ""}`);

  if (!onlyArg || onlyArg === "players") {
    await migrateTable(supabase, "player_social_posts", "image_url", "posted_at");
  }
  if (!onlyArg || onlyArg === "teams") {
    await migrateTable(supabase, "team_social_posts", "thumbnail_url", "published_at");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
