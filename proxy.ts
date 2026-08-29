import { NextResponse, type NextRequest } from "next/server";
import { fanSiteHosts } from "@/lib/team-themes";
import { attachRefreshedSession } from "@/lib/supabase/auth-middleware";

const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin"]);
const MOBILE_API_PREFIX = "/api/mobile/v1/";
const MOBILE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type, X-Minion-Installation-Id",
  "Access-Control-Max-Age": "86400",
};

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => (
    name.startsWith("sb-") && /-auth-token(?:\.\d+)?$/.test(name)
  ));
}

function getSubdomain(host: string) {
  const hostname = host.split(":")[0];
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lckhub.com";

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return null;
  }

  if (hostname.endsWith(`.${rootDomain}`)) {
    return hostname.replace(`.${rootDomain}`, "");
  }

  if (hostname.endsWith(".localhost")) {
    return hostname.replace(".localhost", "");
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const subdomain = getSubdomain(host);
  const { pathname, search } = request.nextUrl;

  // 정적 GET route는 Next가 OPTIONS를 자동 생성하지 않아 Expo Web의 CORS
  // preflight가 405가 될 수 있다. 모바일 API는 route 종류와 무관하게 여기서 끝낸다.
  if (request.method === "OPTIONS" && pathname.startsWith(MOBILE_API_PREFIX)) {
    return new NextResponse(null, { status: 204, headers: MOBILE_CORS_HEADERS });
  }

  // 기존 서브도메인 rewrite 동작을 유지하면서, 응답에 갱신된 인증 세션 쿠키를 심는다.
  let response: NextResponse;

  if (
    !subdomain ||
    RESERVED_SUBDOMAINS.has(subdomain) ||
    !fanSiteHosts.includes(subdomain as (typeof fanSiteHosts)[number]) ||
    pathname.startsWith(`/fan/${subdomain}`)
  ) {
    response = NextResponse.next();
  } else {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/fan/${subdomain}${pathname === "/" ? "" : pathname}`;
    rewriteUrl.search = search;
    response = NextResponse.rewrite(rewriteUrl);
  }

  // 쿠키가 없는 공개 방문과 Bearer 토큰을 직접 검증하는 모바일 API에서는
  // Supabase Auth 네트워크 검증을 실행할 이유가 없다.
  if (!pathname.startsWith(MOBILE_API_PREFIX) && hasSupabaseAuthCookie(request)) {
    await attachRefreshedSession(request, response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
