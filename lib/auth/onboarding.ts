export function safeOnboardingNext(value: string | string[] | undefined, fallback = "/me") {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/onboarding/")
    ? candidate
    : fallback;
}
