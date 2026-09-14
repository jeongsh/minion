export function instagramLoginError(username: string, hasSession: boolean) {
  return new Error(hasSession
    ? `INSTAGRAM_SESSION_REJECTED: @${username}; saved session requires login; refresh INSTAGRAM_SESSION_COOKIE`
    : `INSTAGRAM_LOGIN_REQUIRED: @${username}; public profile requires login`);
}

export function instagramFailureKind(message: string) {
  if (/INSTAGRAM_HTTP_429:/.test(message)) return "rate_limit";
  if (/INSTAGRAM_(?:SESSION_)?CHALLENGE:/.test(message)) return "challenge";
  if (/INSTAGRAM_(?:SESSION_REJECTED|LOGIN_REQUIRED|HTTP_401|HTTP_403|EMPTY):/.test(message)) return "access";
  return "other";
}

export function instagramStopReason(message: string, consecutiveAccessFailures: number) {
  const kind = instagramFailureKind(message);
  if (kind === "rate_limit") return "Instagram rate limit; stopped without retrying. Honor Retry-After before another run.";
  if (kind === "challenge") return "Instagram account verification required; stopped without retrying.";
  if (kind === "access" && consecutiveAccessFailures >= 3) return "Three consecutive Instagram access failures; verify the saved session before another run.";
  return null;
}
