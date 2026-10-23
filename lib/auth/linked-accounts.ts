import type { User } from "@supabase/supabase-js";

export const LINK_PROVIDERS = [
  { value: "google", label: "구글" },
  { value: "kakao", label: "카카오" },
  { value: "naver", label: "네이버" },
] as const;

export type LinkProvider = typeof LINK_PROVIDERS[number]["value"];

// Naver creates an email identity to issue magic-link sessions, without a password.
export function hasEmailPassword(user: Pick<User, "app_metadata">) {
  return user.app_metadata.provider !== "custom:naver"
    && user.app_metadata.naver_login_only !== true
    && Array.isArray(user.app_metadata.providers)
    && user.app_metadata.providers.includes("email");
}

export function isLinkedProvider(user: User, provider: LinkProvider) {
  if (provider === "naver") {
    return typeof user.app_metadata.naver_id === "string"
      || user.app_metadata.provider === "custom:naver";
  }
  return user.identities?.some((identity) => identity.provider === provider) ?? false;
}

export const ACCOUNT_LINK_COOKIE = "minion_account_link";
export const ACCOUNT_LINK_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};
