const LEAGUEPEDIA_API = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1 (image sync; contact: local-dev)";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 10;
const BATCH_SIZE = 40;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFilename(value: string) {
  return value.replace(/^File:/i, "").trim();
}

export function isLeaguepediaImageUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function leaguepediaImageFilename(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (isLeaguepediaImageUrl(trimmed)) return trimmed;
  return normalizeFilename(trimmed);
}

type ImageInfoPage = {
  title?: string;
  missing?: string;
  imageinfo?: Array<{ url?: string }>;
};

async function queryImageUrls(
  filenames: string[],
  onRetry?: (waitMs: number) => void,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (filenames.length === 0) return result;

  const titles = filenames.map((filename) => `File:${filename}`).join("|");
  const searchParams = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url",
    titles,
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(`${LEAGUEPEDIA_API}?${searchParams}`, {
      headers: { "user-agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Leaguepedia image query failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      query?: { pages?: Record<string, ImageInfoPage> };
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = Math.min((attempt + 1) * 20_000, 120_000);
      onRetry?.(waitMs);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(`Leaguepedia image query [${body.error.code}]: ${body.error.info}`);
    }

    for (const page of Object.values(body.query?.pages ?? {})) {
      const url = page.imageinfo?.[0]?.url?.trim();
      if (!url || !page.title) continue;
      result.set(normalizeFilename(page.title), url);
    }

    await sleep(REQUEST_DELAY_MS);
    return result;
  }

  throw new Error("Leaguepedia image query: rate limit retries exhausted.");
}

export async function resolveLeaguepediaImageUrls(
  inputs: Array<string | null | undefined>,
  options: { onRetry?: (waitMs: number) => void } = {},
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  for (const input of inputs) {
    const value = leaguepediaImageFilename(input);
    if (!value) continue;
    if (isLeaguepediaImageUrl(value)) {
      resolved.set(value, value);
    }
  }

  const filenames = [
    ...new Set(
      inputs
        .map((input) => leaguepediaImageFilename(input))
        .filter((value): value is string => !!value && !isLeaguepediaImageUrl(value)),
    ),
  ];

  for (let index = 0; index < filenames.length; index += BATCH_SIZE) {
    const chunk = filenames.slice(index, index + BATCH_SIZE);
    const batch = await queryImageUrls(chunk, options.onRetry);
    for (const [filename, url] of batch) {
      resolved.set(filename, url);
    }
  }

  return resolved;
}

export async function resolveLeaguepediaImageUrl(
  input: string | null | undefined,
  options: { onRetry?: (waitMs: number) => void } = {},
) {
  const filename = leaguepediaImageFilename(input);
  if (!filename) return null;
  if (isLeaguepediaImageUrl(filename)) return filename;

  const resolved = await resolveLeaguepediaImageUrls([filename], options);
  return resolved.get(filename) ?? null;
}
