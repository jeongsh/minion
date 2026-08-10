/**
 * R2로 완전히 이관 완료한 Supabase Storage의 instagram-media 버킷 원본을 정리한다.
 * 실행 전에 DB(모든 image_url/thumbnail_url이 R2를 가리키는지)와 R2 실제 객체 수를
 * 먼저 대조 확인했다 — 되돌릴 수 없는 삭제이므로 재실행 전 반드시 재확인할 것.
 *
 * 사용법:
 *   npx tsx scripts/delete-supabase-instagram-media.ts --dry-run
 *   npx tsx scripts/delete-supabase-instagram-media.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { INSTAGRAM_MEDIA_BUCKET } from "../lib/sync/instagram.ts";

const dryRun = process.argv.includes("--dry-run");
const LIST_PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;

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
  const supabase = createSupabaseAdminClient();

  const allPaths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(INSTAGRAM_MEDIA_BUCKET)
      .list("posts", { limit: LIST_PAGE_SIZE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) allPaths.push(`posts/${item.name}`);
    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  console.log(`[mode] dryRun=${dryRun}, 대상 ${allPaths.length}개`);
  if (dryRun) return;

  let deleted = 0;
  for (let i = 0; i < allPaths.length; i += DELETE_BATCH_SIZE) {
    const batch = allPaths.slice(i, i + DELETE_BATCH_SIZE);
    const { error } = await supabase.storage.from(INSTAGRAM_MEDIA_BUCKET).remove(batch);
    if (error) throw error;
    deleted += batch.length;
    console.log(`  ...${deleted}/${allPaths.length}`);
  }

  console.log(`삭제 완료: ${deleted}개`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
