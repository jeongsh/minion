import { NextResponse, type NextRequest } from "next/server";
import { fanSiteHosts } from "@/lib/team-themes";

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

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const subdomain = getSubdomain(host);
  const { pathname, search } = request.nextUrl;

  if (
    !subdomain ||
    RESERVED_SUBDOMAINS.has(subdomain) ||
    !fanSiteHosts.includes(subdomain as (typeof fanSiteHosts)[number]) ||
    pathname.startsWith(`/fan/${subdomain}`)
  ) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/fan/${subdomain}${pathname === "/" ? "" : pathname}`;
  rewriteUrl.search = search;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
