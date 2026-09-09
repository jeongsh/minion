import assert from "node:assert/strict";
import test from "node:test";
import { unstable_getResponseFromNextConfig, getRedirectUrl } from "next/experimental/testing/server.js";
import nextConfig from "../next.config.ts";

for (const [source, destination] of [
  ["https://www.minion.fan/", "https://minion.fan/"],
  ["http://www.minion.fan/players/faker", "https://minion.fan/players/faker"],
  ["https://www.minion.fan/schedule?team=t1&year=2026", "https://minion.fan/schedule?team=t1&year=2026"],
  ["https://www.minion.fan/sitemap.xml", "https://minion.fan/sitemap.xml"],
]) {
  test(`canonical redirect preserves path and query: ${source}`, async () => {
    const response = await unstable_getResponseFromNextConfig({ url: source, nextConfig });
    assert.equal(response.status, 308);
    assert.equal(getRedirectUrl(response), destination);
  });
}

for (const host of ["minion.fan", "t1.minion.fan", "localhost:3000", "preview.vercel.app", "wwwXminionYfan"]) {
  test(`canonical redirect leaves other hosts unchanged: ${host}`, async () => {
    const response = await unstable_getResponseFromNextConfig({ url: `https://${host}/schedule`, nextConfig });
    assert.equal(response.status, 200);
    assert.equal(getRedirectUrl(response), null);
  });
}
