// AdSense와 Search Console 조회용 Google OAuth refresh token을 한 번 발급한다.
// 사용법:
//   1. Google Cloud Console에서 AdSense Management API, Google Search Console API를 사용 설정한다.
//   2. OAuth 클라이언트(유형: 데스크톱 앱)를 만들고 ID와 보안 비밀을 환경변수로 넘긴다.
//   3. GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node --experimental-strip-types scripts/google-oauth-refresh-token.ts
//   4. 출력된 URL에서 AdSense와 Search Console 권한이 있는 Google 계정으로 동의한다.
//   5. 터미널에 출력된 refresh token을 Vercel 환경변수 GOOGLE_OAUTH_REFRESH_TOKEN에 넣는다.
import { createServer } from "node:http";

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("GOOGLE_OAUTH_CLIENT_ID와 GOOGLE_OAUTH_CLIENT_SECRET을 환경변수로 넘겨주세요.");
  process.exit(1);
}

const port = Number(process.env.OAUTH_PORT ?? 53682);
const redirectUri = `http://127.0.0.1:${port}/callback`;
const scopes = [
  "https://www.googleapis.com/auth/adsense.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", scopes.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", redirectUri);
  if (url.pathname !== "/callback") {
    response.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end(`인증 실패: ${url.searchParams.get("error")}`);
    server.close();
    process.exit(1);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenResponse.json()) as { refresh_token?: string; error?: string; error_description?: string };

  if (!token.refresh_token) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("refresh token을 받지 못했습니다. 터미널을 확인하세요.");
    console.error("토큰 발급 실패:", token.error, token.error_description);
    server.close();
    process.exit(1);
  }

  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("발급 완료. 터미널로 돌아가세요.");
  console.log("\nGOOGLE_OAUTH_REFRESH_TOKEN=" + token.refresh_token + "\n");
  server.close();
});

server.listen(port, "127.0.0.1", () => {
  console.log("브라우저에서 아래 주소를 열어 동의해주세요.\n");
  console.log(authUrl.toString());
});
