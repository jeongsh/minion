import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

import { cookies, headers } from "next/headers";

import { nicknameFromKey } from "@/lib/community/guest-nickname";

const GUEST_COOKIE_NAME = "community_guest_id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const INSTALLATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GuestIdentity = {
  key: string;
  nickname: string;
  ipKey: string;
  ipLabel: string;
};

function guestSecret(): string {
  const secret = process.env.COMMUNITY_GUEST_IP_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("비회원 작성 기능은 COMMUNITY_GUEST_IP_SECRET 설정이 필요합니다.");
  }
  return secret;
}

function digest(scope: "guest" | "ip", value: string): string {
  return createHmac("sha256", guestSecret()).update(`${scope}:${value}`).digest("hex");
}

function normalizeIp(value: string): string | null {
  const candidate = value.trim().replace(/^\[|\]$/g, "");
  const withoutPort = candidate.includes(".") && candidate.includes(":")
    ? candidate.replace(/:\d+$/, "")
    : candidate;
  const normalized = withoutPort.toLowerCase().startsWith("::ffff:")
    ? withoutPort.slice(7)
    : withoutPort;
  return isIP(normalized) ? normalized : null;
}

function adminIpLabel(ip: string): string {
  if (isIP(ip) === 4) {
    const [first, second] = ip.split(".");
    return `${first}.${second}.*.*`;
  }
  if (ip === "::1") return "127.0.*.*";
  const visible = ip.split(":").filter(Boolean).slice(0, 3);
  return `${visible.join(":")}:*`;
}

function ipFromHeaders(requestHeaders: Headers): string {
  const raw =
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]
    ?? requestHeaders.get("cf-connecting-ip")
    ?? requestHeaders.get("x-real-ip")
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]
    ?? "";
  const ip = normalizeIp(raw) ?? (process.env.NODE_ENV === "development" ? "127.0.0.1" : null);
  if (!ip) throw new Error("접속 IP를 확인할 수 없어 비회원으로 작성할 수 없습니다.");
  return ip;
}

async function currentIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export async function getExistingGuestKey(): Promise<string | null> {
  const token = (await cookies()).get(GUEST_COOKIE_NAME)?.value;
  return token && GUEST_TOKEN_PATTERN.test(token) ? digest("guest", token) : null;
}

export async function getGuestIdentity(): Promise<GuestIdentity> {
  const cookieStore = await cookies();
  let token = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (!token || !GUEST_TOKEN_PATTERN.test(token)) {
    token = randomBytes(24).toString("base64url");
    cookieStore.set(GUEST_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: GUEST_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  const ip = await currentIp();
  const key = digest("guest", token);
  return {
    key,
    nickname: nicknameFromKey(key),
    ipKey: digest("ip", ip),
    ipLabel: adminIpLabel(ip),
  };
}

/** 네이티브 앱의 보안 저장소 설치 ID를 웹의 익명 쿠키와 같은 책임으로 사용한다. */
export function getMobileGuestIdentity(request: Request): GuestIdentity {
  const installationId = request.headers.get("x-minion-installation-id")?.trim() ?? "";
  if (!INSTALLATION_ID_PATTERN.test(installationId)) {
    throw new Error("비회원 ID를 확인하지 못했습니다. 앱을 다시 실행해주세요.");
  }
  const ip = ipFromHeaders(request.headers);
  const key = digest("guest", installationId);
  return {
    key,
    nickname: nicknameFromKey(key),
    ipKey: digest("ip", ip),
    ipLabel: adminIpLabel(ip),
  };
}
