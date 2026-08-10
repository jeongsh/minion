import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 uploads require R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function getPublicUrlBase(): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) throw new Error("R2 uploads require NEXT_PUBLIC_R2_PUBLIC_URL.");
  return base.replace(/\/$/, "");
}

/** 지정한 path로 R2에 업로드하고 공개 URL을 돌려준다. */
export async function uploadToR2(path: string, bytes: Buffer, contentType: string): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2 uploads require R2_BUCKET_NAME.");

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: bytes,
      ContentType: contentType,
    }),
  );

  return `${getPublicUrlBase()}/${path}`;
}

/** URL이 R2 공개 도메인(NEXT_PUBLIC_R2_PUBLIC_URL)을 통해 저장된 것인지 확인한다. */
export function isR2Url(url: string): boolean {
  try {
    return `${url.split("?")[0]}/`.startsWith(`${getPublicUrlBase()}/`);
  } catch {
    return false;
  }
}
