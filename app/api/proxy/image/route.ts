const ALLOWED_HOSTS = [
  "scontent-icn2-1.cdninstagram.com",
  "scontent-gmp1-1.cdninstagram.com",
  "scontent.cdninstagram.com",
  "cdninstagram.com",
  "instagram.com",
];

// 동기화 후 영구 저장된 이미지는 Supabase Storage 공개 URL로 바뀐다.
// 프런트는 동일하게 프록시를 거치므로, 우리 Storage 호스트도 허용한다.
function supabaseHost(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
}

function isAllowedUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    if (hostname === supabaseHost()) return true;
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || !isAllowedUrl(url)) {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://www.instagram.com/",
      },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return new Response("Not Found", { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Bad Gateway", { status: 502 });
  }
}
