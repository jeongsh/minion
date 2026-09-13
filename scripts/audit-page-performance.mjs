// Public GET/browser audit. No form submissions; ordinary page-view side effects apply.
// node scripts/audit-page-performance.mjs [origin] [output-directory]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const origin = process.argv[2] || 'https://minion.fan';
const output = path.resolve(process.argv[3] || 'artifacts/performance-audit-2026-09-13');
await fs.mkdir(output, { recursive: true });
const headers = { 'X-Minion-Installation-Id': '0fd0415e-cfea-487a-af5c-0e7bf8bf76d2' };
const result = { origin, measuredAt: new Date().toISOString(), conditions: 'Unauthenticated Chromium 390x844, fresh context per route, no throttling, 4s after DOMContentLoaded. API 3 sequential samples; first is not necessarily cold. No real-device/field percentiles.', apis: [], pages: [] };
const save = () => fs.writeFile(path.join(output, 'measurements.json'), JSON.stringify(result, null, 2));
const seeds = {};
async function api(route, repeats = 3) {
  for (let repeat = 1; repeat <= repeats; repeat++) {
    const start = performance.now();
    try {
      const response = await fetch(origin + '/api/mobile/v1' + route, { headers, signal: AbortSignal.timeout(45000) });
      const text = await response.text();
      const json = JSON.parse(text);
      if (json.data) seeds[route] = json.data;
      const row = { route, repeat, status: response.status, ms: Math.round(performance.now() - start), bytes: Buffer.byteLength(text), cache: response.headers.get('x-vercel-cache'), region: response.headers.get('x-vercel-id'), cacheControl: response.headers.get('cache-control'), error: json.error };
      result.apis.push(row); console.log(JSON.stringify({ api: row }));
    } catch (error) { result.apis.push({ route, repeat, error: String(error) }); }
    await save();
  }
}
for (const route of ['/home', '/bootstrap', '/schedule', '/predictions', '/teams', '/players', '/champions', '/tournaments', '/news', '/community/posts', '/community/posts?team=t1', '/minicons', '/support/inquiries', '/search?q=Faker']) await api(route);
const match = seeds['/home']?.calendar?.flatMap(day => day.matches).find(item => item.status === 'completed')?.id;
const post = seeds['/community/posts']?.items?.[0]?.id;
let postTeam = 't1';
let teamPost = seeds['/community/posts?team=t1']?.items?.[0]?.id;
if (!teamPost) {
  await api('/community/posts?team=hle');
  postTeam = 'hle';
  teamPost = seeds['/community/posts?team=hle']?.items?.[0]?.id;
}
const inquiry = seeds['/support/inquiries']?.items?.find(item => !item.isPrivate)?.id;
for (const route of ['/players/faker', '/players/chovy', '/champions/orianna', '/champions/vi', '/teams/t1', '/teams/t1/fan', '/tournaments/lck', '/tournaments/msi', ...(match ? [`/matches/${match}?tab=data`, `/matches/${match}?tab=preview`, `/matches/${match}?tab=rating`] : []), ...(post ? [`/community/posts/${post}`] : []), ...(teamPost ? [`/community/posts/${teamPost}`] : []), ...(inquiry ? [`/support/inquiries/${inquiry}`] : [])]) await api(route);
const author = post ? seeds[`/community/posts/${post}`]?.author?.id : null;
const routes = ['/', '/schedule', '/predictions', '/tournaments', '/tournaments/lck', '/tournaments/msi', '/teams', '/teams?team=t1', '/players', '/players/faker', '/players/chovy', '/champions', '/champions/orianna', '/champions/orianna?tab=matchups', '/champions/orianna?tab=games', '/champions/vi', '/news', '/community', '/community/free', '/community/rules', '/minicons', '/support', '/about', '/advertising', '/policies', '/privacy', '/terms', '/login', '/signup', '/forgot-password', '/me', '/me/profile', '/me/settings', '/me/minicons', '/minicons/apply', '/community/new', '/support/new', '/fan/t1', '/fan/t1/info', '/fan/t1/players', '/fan/t1/players/faker', '/fan/t1/matches', '/fan/t1/videos', '/fan/t1/social', '/fan/t1/instagram', '/fan/t1/onion', '/fan/t1/community', '/fan/t1/community/free', '/fan/t1/community/rules', ...(match ? [`/matches/${match}`, `/matches/${match}?tab=preview`, `/matches/${match}?tab=rating`] : []), ...(post ? [`/community/post/${post}`, `/community/post/${post}/edit`] : []), ...(teamPost ? [`/fan/${postTeam}/community/post/${teamPost}`] : []), ...(author ? [`/community/user/${author}`] : []), ...(inquiry ? [`/support/${inquiry}`] : [])];
const snapshotSet = match ? seeds[`/matches/${match}?tab=data`]?.sets?.[0]?.id : null;
if (snapshotSet) routes.push(`/matches/${match}/sets/${snapshotSet}/snapshot`);
if (teamPost) routes.push(`/fan/${postTeam}/community/post/${teamPost}/edit`);
const browser = await chromium.launch({ headless: true });
try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('CSS.enable').catch(() => {});
    const resources = new Map();
    cdp.on('Network.responseReceived', ({ requestId, type, response }) => resources.set(requestId, { type, url: response.url, status: response.status, bytes: 0 }));
    cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => { if (resources.has(requestId)) resources.get(requestId).bytes = encodedDataLength; });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      window.__audit = { lcp: 0, longTasks: [] };
      new PerformanceObserver(list => { window.__audit.lcp = list.getEntries().at(-1).startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { window.__audit.longTasks.push(...list.getEntries().map(item => item.duration)); }).observe({ type: 'longtask', buffered: true });
    });
    try {
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4000);
      const state = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return { title: document.title, url: location.href, lcpMs: Math.round(window.__audit.lcp), finalHeaderMs: Math.round((nav.finalResponseHeadersStart || nav.responseStart) - nav.requestStart), dclMs: Math.round(nav.domContentLoadedEventEnd), longTasks: window.__audit.longTasks, domNodes: document.querySelectorAll('*').length, pending: document.documentElement.getAttribute('data-navigation-pending'), links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')) };
      });
      if (route === '/fan/t1/videos') {
        const video = state.links.find(href => /^\/fan\/t1\/videos\/[^/]+$/.test(href));
        if (video) routes.push(video);
      }
      if (route === `/community/post/${post}`) {
        const user = state.links.find(href => /^\/community\/user\//.test(href));
        if (user && !routes.includes(user)) routes.push(user);
      }
      delete state.links;
      const entries = [...resources.values()];
      const row = { route, status: response.status(), ...state, errors, bytes: entries.reduce((sum, item) => sum + item.bytes, 0), byType: Object.fromEntries([...new Set(entries.map(item => item.type))].map(type => [type, { count: entries.filter(item => item.type === type).length, bytes: entries.filter(item => item.type === type).reduce((sum, item) => sum + item.bytes, 0) }])), largestResources: entries.sort((a, b) => b.bytes - a.bytes).slice(0, 10) };
      result.pages.push(row);
      console.log(JSON.stringify({ page: route, status: row.status, lcp: row.lcpMs, bytes: row.bytes, errors: errors.length }));
    } catch (error) { result.pages.push({ route, error: String(error) }); }
    await save(); await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output, 'seeds.json'), JSON.stringify(seeds, null, 2));
