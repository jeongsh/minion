/**
 * Instagram 페이지 로딩 시 실제로 어떤 API URL이 호출되는지 확인하는 디버그 스크립트
 * 사용: npx tsx scripts/debug-instagram.ts <username>
 */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...vals] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = vals.join("=");
    }
  } catch { /* optional */ }
}

loadEnv();

const username = process.argv[2] ?? "lck";
const sessionCookie = process.env.INSTAGRAM_SESSION_COOKIE?.trim();

async function main() {
  console.log(`\n=== Instagram Debug: @${username} ===\n`);
  if (sessionCookie) {
    console.log(`[cookie] loaded (${sessionCookie.slice(0, 30)}...)\n`);
  } else {
    console.log("[cookie] NONE — 비로그인 모드\n");
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });

  if (sessionCookie) {
    const cookies = sessionCookie
      .split(";")
      .map((pair) => {
        const idx = pair.indexOf("=");
        if (idx === -1) return null;
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        return name
          ? { name, value, domain: ".instagram.com", path: "/", secure: true, sameSite: "None" as const }
          : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    await context.addCookies(cookies);
    console.log(`[cookies set] ${cookies.map((c) => c.name).join(", ")}\n`);
  }

  const page = await context.newPage();

  // ── 모든 요청 로그 ──
  page.on("request", (req) => {
    const url = req.url();
    if (
      url.includes("instagram.com") &&
      !url.match(/\.(png|jpg|jpeg|gif|webp|mp4|svg|woff|ico|css)(\?|$)/)
    ) {
      console.log(`→ REQ  ${req.method()} ${url.slice(0, 140)}`);
    }
  });

  // ── 모든 응답 로그 ──
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    const status = res.status();

    if (
      url.includes("instagram.com") &&
      !url.match(/\.(png|jpg|jpeg|gif|webp|mp4|svg|woff|ico|css)(\?|$)/)
    ) {
      const isJson = ct.includes("json");
      const isJs = ct.includes("javascript");
      const isApiUrl = url.includes("graphql") || url.includes("/api/") || url.includes("web_profile_info");

      console.log(`← RES  ${status} [${ct.slice(0, 25)}] ${url.slice(0, 140)}`);

      // JSON 또는 API URL의 JS 응답 본문 출력
      if (isJson || (isJs && isApiUrl)) {
        try {
          const text = await res.text();
          console.log(`   preview: ${text.slice(0, 400)}\n`);
        } catch {
          console.log("   (body read failed)\n");
        }
      }
    }
  });

  console.log(`Navigating to https://www.instagram.com/${username}/ ...\n`);

  try {
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle",
      timeout: 40_000,
    });
  } catch (e) {
    console.log(`[warn] goto: ${(e as Error).message}`);
  }

  await page.waitForTimeout(5_000);

  console.log("\n--- Page title:", await page.title());

  // 쿠키 확인
  const finalCookies = await context.cookies("https://www.instagram.com");
  console.log(
    "Final cookies:",
    finalCookies.map((c) => `${c.name}=${c.value.slice(0, 10)}...`).join(", "),
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
