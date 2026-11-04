import { createPrivateKey, sign } from "node:crypto";
import type { User } from "@supabase/supabase-js";

// Sign in with Apple 계정 탈퇴 시 Apple 토큰을 해지한다(App Store 심사 5.1.1(v)).
// client_id는 Supabase Apple provider에 등록한 Services ID와 같아야 한다.
const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export type AppleRevokeToken = { token: string; tokenTypeHint: "refresh_token" | "access_token" };

export function isAppleUser(user: Pick<User, "app_metadata" | "identities">) {
  return user.app_metadata?.provider === "apple"
    || (user.identities?.some((identity) => identity.provider === "apple") ?? false);
}

// 재인증 직후 세션에 남아 있는 provider 토큰을 고른다. refresh token 해지가 모든 토큰을 무효화한다.
export function appleRevokeTokenFrom(input: { providerRefreshToken?: string | null; providerToken?: string | null } | null | undefined): AppleRevokeToken | null {
  const refresh = input?.providerRefreshToken?.trim();
  if (refresh) return { token: refresh, tokenTypeHint: "refresh_token" };
  const access = input?.providerToken?.trim();
  if (access) return { token: access, tokenTypeHint: "access_token" };
  return null;
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function appleClientSecret(config: { clientId: string; keyId: string; privateKey: string; teamId: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64Url(JSON.stringify({ aud: APPLE_AUDIENCE, exp: now + 300, iat: now, iss: config.teamId, sub: config.clientId }));
  const key = createPrivateKey(config.privateKey.replace(/\\n/g, "\n"));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { dsaEncoding: "ieee-p1363", key });
  return `${header}.${payload}.${base64Url(signature)}`;
}

// 해지 실패는 탈퇴를 막지 않는다. 호출한 쪽은 결과를 기록만 한다.
export async function revokeAppleToken(token: AppleRevokeToken): Promise<{ ok: boolean; reason?: string }> {
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const teamId = process.env.APPLE_TEAM_ID;
  if (!clientId || !keyId || !privateKey || !teamId) return { ok: false, reason: "missing_config" };
  try {
    const response = await fetch(APPLE_REVOKE_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: appleClientSecret({ clientId, keyId, privateKey, teamId }),
        token: token.token,
        token_type_hint: token.tokenTypeHint,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    return response.ok ? { ok: true } : { ok: false, reason: `http_${response.status}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "request_failed" };
  }
}
