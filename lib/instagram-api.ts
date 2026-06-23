/**
 * RapidAPI Instagram API 클라이언트
 * https://rapidapi.com/mobilemassagesla/api/instagram-api-followers-following-stories-info
 */

const RAPIDAPI_HOST = "instagram-api-followers-following-stories-info.p.rapidapi.com";

function getApiKey(): string {
  const key = process.env.RAPIDAPI_KEY?.trim();
  if (!key) throw new Error("RAPIDAPI_KEY 환경변수가 설정되지 않았습니다.");
  return key;
}

async function get(path: string, params: Record<string, string>) {
  const url = new URL(`https://${RAPIDAPI_HOST}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": getApiKey(),
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(`RapidAPI ${path} → HTTP ${res.status} | ${body.slice(0, 300)}`);
  }

  return res.json();
}

// ─── 응답 타입 ──────────────────────────────────────────────────

export type RapidApiMediaItem = {
  pk: string;
  code?: string;
  taken_at?: number;
  expiring_at?: number;
  media_type?: number; // 1=image 2=video 8=carousel
  like_count?: number;
  comment_count?: number;
  caption?: { text?: string } | null;
  image_versions2?: { candidates?: { url: string; width: number; height: number }[] };
  video_url?: string | null;
  carousel_media?: RapidApiMediaItem[];
};

export type RapidApiFeedResponse = {
  data?: {
    items?: RapidApiMediaItem[];
    user?: { username?: string };
  };
  items?: RapidApiMediaItem[];
};

export type RapidApiStoriesResponse = {
  data?: {
    reels?: {
      items?: RapidApiMediaItem[];
      user?: { username?: string; profile_pic_url?: string; full_name?: string };
    };
    items?: RapidApiMediaItem[];
  };
  reels?: { items?: RapidApiMediaItem[] };
  items?: RapidApiMediaItem[];
};

// ─── API 메서드 ─────────────────────────────────────────────────

export async function fetchUserFeed(usernameOrUrl: string): Promise<RapidApiMediaItem[]> {
  const data = (await get("/api/v1/user/feed", {
    username_or_id_or_url: usernameOrUrl,
  })) as RapidApiFeedResponse;

  return data?.data?.items ?? data?.items ?? [];
}

export async function fetchUserStories(usernameOrUrl: string): Promise<RapidApiMediaItem[]> {
  const data = (await get("/api/v1/user/stories", {
    username_or_id_or_url: usernameOrUrl,
  })) as RapidApiStoriesResponse;

  return (
    data?.data?.reels?.items ??
    data?.data?.items ??
    data?.reels?.items ??
    data?.items ??
    []
  );
}

export async function fetchUserReels(usernameOrUrl: string): Promise<RapidApiMediaItem[]> {
  const data = (await get("/api/v1/user/reels", {
    username_or_id_or_url: usernameOrUrl,
  })) as RapidApiFeedResponse;

  return data?.data?.items ?? data?.items ?? [];
}

// ─── 공통 파싱 헬퍼 ─────────────────────────────────────────────

export function getBestImageUrl(item: RapidApiMediaItem): string {
  const candidates = item.image_versions2?.candidates ?? [];
  // 가장 큰 이미지 우선 (width 내림차순)
  const sorted = [...candidates].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? "";
}

export function getShortcode(item: RapidApiMediaItem): string {
  if (item.code) return item.code;
  // pk → shortcode 변환 (Instagram 내부 방식, BigInt 대신 문자열 나눗셈 사용)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let shortcode = "";
  let pk = item.pk.replace(/\D/g, "");
  while (pk !== "0" && pk !== "") {
    // 문자열로 64 나눗셈
    let remainder = 0;
    let result = "";
    for (const digit of pk) {
      const cur = remainder * 10 + parseInt(digit);
      result += Math.floor(cur / 64);
      remainder = cur % 64;
    }
    shortcode = chars[remainder] + shortcode;
    pk = result.replace(/^0+/, "") || "0";
    if (pk === "0") break;
  }
  return shortcode || item.pk;
}

export function getCaption(item: RapidApiMediaItem): string {
  if (typeof item.caption === "string") return item.caption;
  return item.caption?.text ?? "";
}
