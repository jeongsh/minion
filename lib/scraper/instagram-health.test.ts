import test, { after } from "node:test";
import assert from "node:assert/strict";
import { getBrowser, closeBrowser, scrapeInstagramPosts } from "./instagram-browser.ts";

after(closeBrowser);
async function fixture(html: (cookie: string) => string, action: () => Promise<void>) {
  const browser = await getBrowser();
  const original = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await original(...args);
    await context.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: html(route.request().headers().cookie ?? "") }));
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
