/** Validate configuration before making a request; never include cookie values in errors. */
export function parseInstagramCookie(cookieString: string): { name: string; value: string }[] {
  const invalid = () => new Error(
    "INSTAGRAM_COOKIE_FORMAT: expected a Cookie header containing sessionid=VALUE; do not paste only the Value, an email code, or a password.",
  );
  const header = cookieString.trim().replace(/^Cookie:\s*/i, "");
  if (!header || /[\r\n]/.test(header)) throw invalid();
  const cookies = header.split(";").filter((pair) => pair.trim()).map((pair) => {
    const separator = pair.indexOf("=");
    if (separator < 1) throw invalid();
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\s"\x00-\x1f\x7f]/.test(value)) throw invalid();
    return { name, value };
  });
  const sessions = cookies.filter(({ name }) => name === "sessionid");
  if (sessions.length !== 1 || !sessions[0].value) throw invalid();
  return cookies;
}
