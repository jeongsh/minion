import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const baseUrl = option("base-url", process.env.BASELINE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = path.resolve(option("output", "docs/baselines/mobile-web/phase-0"));
const samples = Math.max(1, Number(option("samples", "3")) || 3);
const width = Math.max(320, Number(option("width", "390")) || 390);
const height = Math.max(568, Number(option("height", "844")) || 844);
const timeout = Math.max(10_000, Number(option("timeout", "120000")) || 120_000);

const device = {
  viewport: { width, height },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
};

function round(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

async function settle(page) {
  await page.waitForLoadState("load", { timeout });
  await page.locator("main").first().waitFor({ state: "visible", timeout });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function readMetrics(page, response, startedAt, finishedAt) {
  const browserMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(performance.getEntriesByType("paint").map(entry => [entry.name, entry.startTime]));
    const resources = performance.getEntriesByType("resource");
    return {
      navigation: navigation?.toJSON() ?? null,
      paints,
      lcp: globalThis.__minionBaselineLcp ?? null,
      cls: globalThis.__minionBaselineCls ?? 0,
      resourceCount: resources.length,
      transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), navigation?.transferSize || 0),
    };
  });
  const navigation = browserMetrics.navigation;
  const responseEnd = navigation?.responseEnd ?? 0;
  return {
    status: response?.status() ?? null,
    wallMs: round(finishedAt - startedAt),
    ttfbMs: round((navigation?.responseStart ?? 0) - (navigation?.requestStart ?? 0)),
    responseDownloadMs: round(responseEnd - (navigation?.responseStart ?? 0)),
    serverWaitMs: round((navigation?.responseStart ?? 0) - (navigation?.requestStart ?? 0)),
    browserReadyAfterFirstByteMs: round((navigation?.domContentLoadedEventEnd ?? 0) - (navigation?.responseStart ?? 0)),
    domContentLoadedMs: round(navigation?.domContentLoadedEventEnd),
    loadMs: round(navigation?.loadEventEnd),
    fcpMs: round(browserMetrics.paints["first-contentful-paint"]),
    lcpMs: round(browserMetrics.lcp),
    cls: Math.round(browserMetrics.cls * 1000) / 1000,
    resourceCount: browserMetrics.resourceCount,
    transferBytes: browserMetrics.transferBytes,
    serverTiming: response?.headers()["server-timing"] ?? null,
  };
}

async function installObservers(page) {
  await page.addInitScript(() => {
    globalThis.__minionBaselineLcp = null;
    globalThis.__minionBaselineCls = 0;
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      globalThis.__minionBaselineLcp = entries.at(-1)?.startTime ?? null;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) globalThis.__minionBaselineCls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function discoverDynamicPaths(context) {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout });
  await settle(page);
  const paths = await page.evaluate(() => ({
    match: document.querySelector('main a[href^="/matches/"]')?.getAttribute("href") ?? null,
    post: document.querySelector('main a[href^="/community/post/"]')?.getAttribute("href") ?? null,
  }));
  await page.close();
  return paths;
}

async function captureTheme(browser, theme, routes) {
  const context = await browser.newContext({ ...device, colorScheme: theme });
  const themeDir = path.join(outputDir, `${width}x${height}`, theme);
  await mkdir(themeDir, { recursive: true });
  for (const route of routes) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout });
    await settle(page);
    await page.screenshot({ path: path.join(themeDir, `${route.key}.png`), fullPage: true });
    await page.close();
  }
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  const discoveryContext = await browser.newContext(device);
  const dynamicPaths = await discoverDynamicPaths(discoveryContext);
  await discoveryContext.close();

  if (!dynamicPaths.match) throw new Error("홈 화면에서 경기 상세 링크를 찾지 못했습니다.");
  const routes = [
    { key: "home", path: "/" },
    { key: "schedule", path: "/schedule" },
    { key: "match", path: dynamicPaths.match },
    { key: "community", path: "/community" },
    ...(dynamicPaths.post ? [{ key: "community-post", path: dynamicPaths.post }] : []),
  ];

  const context = await browser.newContext({ ...device, colorScheme: "light" });
  const measurements = [];
  for (const route of routes.filter(route => route.key !== "community-post")) {
    const runs = [];
    for (let sample = 0; sample < samples; sample += 1) {
      const page = await context.newPage();
      await installObservers(page);
      const startedAt = performance.now();
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout });
      await settle(page);
      const finishedAt = performance.now();
      runs.push(await readMetrics(page, response, startedAt, finishedAt));
      await page.close();
    }
    measurements.push({
      ...route,
      runs,
      median: Object.fromEntries([
        "wallMs", "serverWaitMs", "browserReadyAfterFirstByteMs", "ttfbMs", "responseDownloadMs", "domContentLoadedMs", "loadMs", "fcpMs", "lcpMs", "transferBytes",
      ].map(key => [key, median(runs.map(run => run[key]))])),
    });
  }
  await context.close();

  await captureTheme(browser, "light", routes);
  await captureTheme(browser, "dark", routes);

  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    source: { baseUrl },
    environment: {
      kind: "Chromium Android emulation",
      viewport: { width, height },
      samples,
      note: "Physical Android measurements must be appended before release targets are frozen.",
    },
    dynamicPaths,
    routes: measurements,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${path.join(outputDir, "metrics.json")}\n`);
} finally {
  await browser.close();
}
