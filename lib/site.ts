export const SITE_NAME = "MINION";
export const POLICY_VERSION = "2026-07-17";
export const POLICY_EFFECTIVE_DATE = "2026년 7월 17일";

export function siteContactEmail() {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL || "lck.minion@gmail.com";
}

export function siteBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  const url = configuredUrl.startsWith("http")
    ? configuredUrl
    : `https://${configuredUrl}`;

  return url.replace(/\/$/, "");
}
