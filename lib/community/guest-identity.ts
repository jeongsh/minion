import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

import { cookies, headers } from "next/headers";

const GUEST_COOKIE_NAME = "community_guest_id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const MINION_PREFIXES = [
  "꾸벅조는", "총총걷는", "뒤뚱대는", "간식찾는", "몰래쉬는", "딴짓하는", "눈치보는", "춤추는",
  "신난", "삐진", "겁먹은", "배고픈", "멍때리는", "수풀숨은", "강구경온", "바론구경온",
  "길을잃은", "집에가고픈", "무리놓친", "늦잠잔", "혼자남은", "뒤처진", "한대남은", "귀환못한",
  "퇴근못한", "살고싶은", "정글에버려진", "미드에서헤맨", "집앞까지온", "넥서스처음본", "마지막까지남은", "아무도안잡는",
  "막타훔친", "막타버틴", "CS다먹은", "귀환끊은", "길막하는", "어그로끈", "라인밀어버린", "라인얼려버린",
  "경험치먹는", "킬먹고간", "펜타뺏은", "점멸뺀", "스킬피한", "논타겟막은", "그랩막아선", "승급전망친",
  "바론버프받은", "장로버프받은", "용막타친", "바론막타친", "정글마실간", "탑끝까지민", "미드달리는", "백도어하는",
  "다이브한", "포탑치는", "포탑맞는", "억제기앞에선", "넥서스치는", "서렌반대한", "와드인척한", "캐리중인",
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
  const prefix = MINION_PREFIXES[Number.parseInt(key.slice(0, 2), 16) % MINION_PREFIXES.length];
  const suffix = (Number.parseInt(key.slice(4, 10), 16) % 10_000).toString().padStart(4, "0");
  return `${prefix}미니언${suffix}`;
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
