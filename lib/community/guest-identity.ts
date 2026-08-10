import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

import { cookies, headers } from "next/headers";

const GUEST_COOKIE_NAME = "community_guest_id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const ADJECTIVES = [
  "차분한", "용감한", "재빠른", "느긋한", "명랑한", "다정한", "영리한", "씩씩한",
  "따뜻한", "신중한", "유쾌한", "반짝이는", "든든한", "푸른", "새벽의", "한결같은",
] as const;

const ANIMALS = [
  "수달", "여우", "판다", "참새", "고래", "해달", "토끼", "사슴",
  "부엉이", "고양이", "강아지", "다람쥐", "펭귄", "돌고래", "두루미", "호랑이",
] as const;

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

function nicknameFromKey(key: string): string {
  const adjective = ADJECTIVES[Number.parseInt(key.slice(0, 2), 16) % ADJECTIVES.length];
  const animal = ANIMALS[Number.parseInt(key.slice(2, 4), 16) % ANIMALS.length];
  const suffix = (Number.parseInt(key.slice(4, 10), 16) % 10_000).toString().padStart(4, "0");
  return `${adjective}${animal}${suffix}`;
}

async function currentIp(): Promise<string> {
  const requestHeaders = await headers();
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
