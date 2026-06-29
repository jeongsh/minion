import { NextResponse, type NextRequest } from "next/server";
import { fanSiteHosts } from "@/lib/team-themes";
import { attachRefreshedSession } from "@/lib/supabase/auth-middleware";

const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin"]);

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

  await attachRefreshedSession(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
