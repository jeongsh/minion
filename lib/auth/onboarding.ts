export const DEFAULT_PROFILE_IMAGES = [
  { label: "파랑 응원단", value: "/images/profile-defaults/minion-blue.webp" },
  { label: "빨강 응원단", value: "/images/profile-defaults/minion-red.webp" },
  { label: "민트 응원단", value: "/images/profile-defaults/minion-mint.webp" },
  { label: "노랑 응원단", value: "/images/profile-defaults/minion-yellow.webp" },
] as const;

export const DEFAULT_PROFILE_IMAGE_URLS = new Set<string>(
  DEFAULT_PROFILE_IMAGES.map((image) => image.value),
);

export function safeOnboardingNext(value: string | string[] | undefined, fallback = "/me") {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/onboarding/")
    ? candidate
    : fallback;
}
