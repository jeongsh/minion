// 동기화 후 영구 저장된 이미지는 Supabase Storage 또는 R2 공개 URL로 바뀐다.
// 프런트는 동일하게 프록시를 거치므로, 우리 스토리지 호스트도 허용한다.
function supabaseHost(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
}

function r2Host(): string | null {
  try {
    return process.env.NEXT_PUBLIC_R2_PUBLIC_URL
      ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
      : null;
  } catch {
    return null;
  }
}

function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    return (url.hostname === supabaseHost() && url.pathname.startsWith("/storage/v1/object/public/"))
      || (url.hostname === r2Host() && !url.pathname.startsWith("/_control/"));
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
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return new Response("Not Found", { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return new Response("Unsupported media", { status: 415 });
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
