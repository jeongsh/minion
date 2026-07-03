const LEAGUEPEDIA_API_URL = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1 (authenticated Leaguepedia Cargo sync)";

type LoginTokenResponse = {
  query?: { tokens?: { logintoken?: string } };
  error?: { code?: string; info?: string };
};

type LoginResponse = {
  login?: { result?: string; reason?: string };
  error?: { code?: string; info?: string };
};

let sessionCookies = new Map<string, string>();
let loginPromise: Promise<void> | null = null;
let loggedIn = false;

function credentials() {
  const username = process.env.LEAGUEPEDIA_BOT_USERNAME?.trim();
  const password = process.env.LEAGUEPEDIA_BOT_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error(
      "Leaguepedia Bot Password 환경변수가 없습니다. LEAGUEPEDIA_BOT_USERNAME과 LEAGUEPEDIA_BOT_PASSWORD를 설정해주세요.",
    );
  }

  return { username, password };
}

function setCookieHeaders(headers: Headers) {
  const headersWithCookies = headers as Headers & { getSetCookie?: () => string[] };
  const values = headersWithCookies.getSetCookie?.() ??
    (headers.get("set-cookie")?.split(/,(?=\s*[^;,=]+=[^;,]+)/) ?? []);

  for (const value of values) {
    const firstPart = value.split(";", 1)[0]?.trim();
    const separator = firstPart?.indexOf("=") ?? -1;
    if (!firstPart || separator <= 0) continue;
    sessionCookies.set(firstPart.slice(0, separator), firstPart.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...sessionCookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function mediaWikiFetch(params: URLSearchParams, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("user-agent", USER_AGENT);
  const cookies = cookieHeader();
  if (cookies) headers.set("cookie", cookies);

  const isPost = init.method === "POST";
  if (isPost) headers.set("content-type", "application/x-www-form-urlencoded");

  const response = await fetch(isPost ? LEAGUEPEDIA_API_URL : `${LEAGUEPEDIA_API_URL}?${params}`, {
    ...init,
    headers,
    body: isPost ? params : undefined,
    cache: "no-store",
  });
  setCookieHeaders(response.headers);
  return response;
}

async function login() {
  const { username, password } = credentials();
  sessionCookies = new Map();
  loggedIn = false;

  const tokenParams = new URLSearchParams({
    action: "query",
    meta: "tokens",
    type: "login",
    format: "json",
    formatversion: "2",
  });
  const tokenResponse = await mediaWikiFetch(tokenParams);
  if (!tokenResponse.ok) {
    throw new Error(`Leaguepedia 로그인 토큰 요청 실패: ${tokenResponse.status}`);
  }
  const tokenBody = (await tokenResponse.json()) as LoginTokenResponse;
  const loginToken = tokenBody.query?.tokens?.logintoken;
  if (!loginToken) {
    throw new Error(`Leaguepedia 로그인 토큰 없음: ${tokenBody.error?.info ?? tokenBody.error?.code ?? "unknown"}`);
  }

  const loginParams = new URLSearchParams({
    action: "login",
    lgname: username,
    lgpassword: password,
    lgtoken: loginToken,
    format: "json",
    formatversion: "2",
  });
  const loginResponse = await mediaWikiFetch(loginParams, { method: "POST" });
  if (!loginResponse.ok) {
    throw new Error(`Leaguepedia 로그인 실패: ${loginResponse.status}`);
  }
  const loginBody = (await loginResponse.json()) as LoginResponse;
  if (loginBody.login?.result !== "Success") {
    throw new Error(
      `Leaguepedia 로그인 실패: ${loginBody.login?.reason ?? loginBody.error?.info ?? loginBody.error?.code ?? loginBody.login?.result ?? "unknown"}`,
    );
  }
  loggedIn = true;
}

async function ensureLoggedIn() {
  if (loggedIn) return;
  loginPromise ??= login().finally(() => {
    loginPromise = null;
  });
  await loginPromise;
}

export async function fetchAuthenticatedLeaguepediaApi(params: URLSearchParams) {
  await ensureLoggedIn();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const authenticatedParams = new URLSearchParams(params);
    authenticatedParams.set("assert", "user");
    const response = await mediaWikiFetch(authenticatedParams);

    if (response.ok) {
      const body = (await response.clone().json().catch(() => null)) as
        | { error?: { code?: string } }
        | null;
      if (body?.error?.code !== "assertuserfailed") return response;
    } else if (response.status !== 401 && response.status !== 403) {
      return response;
    }

    sessionCookies = new Map();
    loggedIn = false;
    await ensureLoggedIn();
  }

  throw new Error("Leaguepedia 인증 세션을 갱신하지 못했습니다.");
}

export function resetLeaguepediaSessionForTests() {
  sessionCookies = new Map();
  loginPromise = null;
  loggedIn = false;
}
