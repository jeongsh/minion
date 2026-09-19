/** Validate configuration before making a request; never include cookie values in errors. */
export function parseInstagramCookie(cookieString: string): { name: string; value: string }[] {
  const invalid = () => new Error(
    "INSTAGRAM_COOKIE_FORMAT: expected sessionid=VALUE or its copied session Value; email codes and passwords are not session cookies.",
  );
  let header = cookieString.trim().replace(/^Cookie:\s*/i, "");
  // DevTools copies only Value. Recognize the delimited session token, not a
  // generic string (which could be an email verification code or password).
  if (/^\d+(?::|%3a)[A-Za-z0-9%:._~+-]+$/i.test(header)) header = `sessionid=${header}`;
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
