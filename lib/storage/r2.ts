import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2 uploads require R2_BUCKET_NAME.");
  return bucket;
}

/** 서버에서 R2 객체 조회·업로드에 필요한 환경변수가 모두 준비됐는지 확인한다. */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID
    && process.env.R2_ACCESS_KEY_ID
    && process.env.R2_SECRET_ACCESS_KEY
    && process.env.R2_BUCKET_NAME
    && process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
  );
}

/** R2 객체 path를 공개 커스텀 도메인 URL로 바꾼다. */
export function r2PublicUrl(path: string): string {
  return `${getPublicUrlBase()}/${path.replace(/^\/+/, "")}`;
}

/** 객체 본문을 내려받지 않고 R2에 이미 존재하는지만 확인한다. */
export async function r2ObjectExists(path: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: getBucketName(), Key: path }));
    return true;
  } catch (error) {
    const status = typeof error === "object" && error && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
    const name = error instanceof Error ? error.name : "";
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return false;
    throw error;
  }
}

/** 지정한 path로 R2에 업로드하고 공개 URL을 돌려준다. */
export async function uploadToR2(
  path: string,
  bytes: Buffer,
  contentType: string,
  options: { cacheControl?: string } = {},
): Promise<string> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: path,
      Body: bytes,
      ContentType: contentType,
      CacheControl: options.cacheControl,
    }),
  );

  return r2PublicUrl(path);
}

/** URL이 R2 공개 도메인(NEXT_PUBLIC_R2_PUBLIC_URL)을 통해 저장된 것인지 확인한다. */
export function isR2Url(url: string): boolean {
  try {
    return `${url.split("?")[0]}/`.startsWith(`${getPublicUrlBase()}/`);
  } catch {
    return false;
  }
}
