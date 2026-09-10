import test, { after } from "node:test";
import assert from "node:assert/strict";
import { getBrowser, closeBrowser, scrapeInstagramPosts } from "./instagram-browser.ts";
import { syncOwnerPosts } from "../sync/instagram.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

after(closeBrowser);
async function fixture(html: (cookie: string) => string, action: () => Promise<void>) {
  const browser = await getBrowser();
  const original = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await original(...args);
    await context.route("**/*", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: html(route.request().headers().cookie ?? "") }));
    return context;
  };
  try { await action(); } finally { browser.newContext = original; }
}
test("blank Instagram output is an error, not a healthy zero-post sync", async () => {
  await fixture(() => "<html><title>Instagram</title><body>Unavailable</body></html>", async () => {
    await assert.rejects(scrapeInstagramPosts("test"), /INSTAGRAM_EMPTY/);
  });
});
test("login page is reported explicitly", async () => {
  await fixture(() => "<html><title>Login • Instagram</title></html>", async () => {
    await assert.rejects(scrapeInstagramPosts("test"), /INSTAGRAM_LOGIN/);
  });
});
test("expired cookie retries public profile and reads its prefetched posts", async () => {
  const data = { polaris_ordered_timeline_connection: { edges: [{ node: { code: "TEST", pk: "1", taken_at: 1789000000, display_uri: "https://example.com/image.jpg", user: { username: "test" }, caption: { text: "test caption" } } }] } };
  let attempts = 0;
  await fixture((cookie) => { attempts++; return cookie.includes("sessionid=") ? "<title>Login • Instagram</title>" : `<script type="application/json">${JSON.stringify(data)}</script>`; }, async () => {
    const posts = await scrapeInstagramPosts("test", "sessionid=expired");
    assert.equal(posts.length, 1);
    assert.equal(posts[0].shortcode, "TEST");
    assert.equal(attempts, 2);
  });
});

test("long captions cannot split an emoji into invalid JSON for Postgres", async () => {
  const caption = "a".repeat(199) + "🔥remaining caption";
  const data = { polaris_ordered_timeline_connection: { edges: [{ node: { code: "EMOJI", pk: "2", taken_at: 1789000000, user: { username: "test" }, caption: { text: caption } } }] } };
  let title = "";
  const database = { from: () => ({ upsert: (payload: { title: string }) => { title = payload.title; return { select: async () => ({ data: [], error: null }) }; } }) } as unknown as SupabaseClient;
  await fixture(() => `<script type="application/json">${JSON.stringify(data)}</script>`, async () => {
    const result = await syncOwnerPosts(database, { kind: "team", id: "team", name: "TEST", instagramUrl: "https://www.instagram.com/test/" }, { noNotify: true });
    assert.equal(result.checked, 1);
    assert.equal(title, "a".repeat(199) + "🔥");
    assert.equal(title.isWellFormed(), true);
  });
});
