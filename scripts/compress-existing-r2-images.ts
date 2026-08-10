/**
 * R2에 이미 올라가 있는 인스타 이미지 중, 리사이즈+webp 압축 로직이 생기기 전에
 * 업로드된 것(확장자가 jpg/png인 것)을 새 업로드 경로와 같은 방식으로 재압축해서
 * 다시 올리고, DB의 image_url/thumbnail_url을 새 경로로 갱신한 뒤 옛 객체를 지운다.
 * GIF는 애니메이션이 깨지므로 건드리지 않는다.
 *
 * 사용법:
 *   npx tsx scripts/compress-existing-r2-images.ts --dry-run
 *   npx tsx scripts/compress-existing-r2-images.ts
 *   npx tsx scripts/compress-existing-r2-images.ts --limit=50
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { resizeImageForWeb } from "../lib/images/resize-for-web.ts";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const limitArg = parseInt(argv.find((a) => a.startsWith("--limit="))?.split("=", 2)[1] ?? "0");

const CONCURRENCY = 15;
const TARGET_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

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

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  return Buffer.from(bytes);
}

async function main() {
  loadEnvFile();

  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const supabase = createSupabaseAdminClient();

  // 1) 압축 대상(webp/gif가 아닌) 객체 전부 나열
  let keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "posts/", ContinuationToken: continuationToken }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      const ext = obj.Key.split(".").pop()?.toLowerCase() ?? "";
      if (TARGET_EXTENSIONS.has(ext)) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (limitArg > 0) keys = keys.slice(0, limitArg);
  console.log(`[mode] dryRun=${dryRun}, 대상 ${keys.length}개`);
  if (dryRun) return;

  let compressed = 0;
  let skipped = 0;
  let savedBytes = 0;

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (oldKey) => {
        try {
          const getRes = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: oldKey }));
          const bytes = await streamToBuffer(getRes.Body);
          const contentType = getRes.ContentType ?? "image/jpeg";

          const resized = await resizeImageForWeb(bytes, contentType, { maxEdge: 1080 });
          if (!resized.transformed) {
            skipped += 1;
            console.error(`  [skip] ${oldKey} — 변환 실패(원본 유지)`);
            return;
          }

          const newKey = oldKey.replace(/\.[^./]+$/, `.${resized.extension}`);
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: newKey,
              Body: resized.bytes,
              ContentType: resized.contentType,
            }),
          );

          const oldUrl = `${publicUrlBase}/${oldKey}`;
          const newUrl = `${publicUrlBase}/${newKey}`;
          if (newKey !== oldKey) {
            if (oldKey.includes("/player_")) {
              await supabase.from("player_social_posts").update({ image_url: newUrl }).eq("image_url", oldUrl);
            } else {
              await supabase.from("team_social_posts").update({ thumbnail_url: newUrl }).eq("thumbnail_url", oldUrl);
            }
            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
          }

          savedBytes += bytes.length - resized.bytes.length;
          compressed += 1;
        } catch (err) {
          skipped += 1;
          console.error(`  [fail] ${oldKey}:`, err instanceof Error ? err.message : err);
        }
      }),
    );
    console.log(`  ...${Math.min(i + CONCURRENCY, keys.length)}/${keys.length}`);
  }

  console.log(`압축 완료: ${compressed}개 / 실패·스킵: ${skipped}개`);
  console.log(`절감 용량: ${(savedBytes / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
