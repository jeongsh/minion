import test, { after } from "node:test";
import assert from "node:assert/strict";
import { getBrowser, closeBrowser, scrapeInstagramPosts } from "./instagram-browser.ts";
import { syncOwnerPosts } from "../sync/instagram.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasConnectionFailure } from "../sync/social-health.ts";
import { parseInstagramCookie } from "./instagram-cookie.ts";

test("cookie configuration requires a single sessionid without revealing values", () => {
  assert.deepEqual(parseInstagramCookie("Cookie: sessionid=secret%3Avalue; csrftoken=csrf; ds_user_id=123"), [
    { name: "sessionid", value: "secret%3Avalue" }, { name: "csrftoken", value: "csrf" }, { name: "ds_user_id", value: "123" },
  ]);
  assert.deepEqual(parseInstagramCookie("123%3Atest-session%3A1%3Atest-signature"), [{ name: "sessionid", value: "123%3Atest-session%3A1%3Atest-signature" }]);
  assert.deepEqual(parseInstagramCookie("123:test-session:1:test-signature"), [{ name: "sessionid", value: "123:test-session:1:test-signature" }]);
  for (const value of ["123456", "private-value", "csrftoken=private-value", "sessionid=", '"sessionid=private-value"', "sessionid=private-value; sessionid=other", "sessionid=private-value\ncsrftoken=other"]) {
    assert.throws(() => parseInstagramCookie(value), (error: Error) => {
      assert.match(error.message, /^INSTAGRAM_COOKIE_FORMAT:/);
      assert.ok(!error.message.includes("private-value"));
      assert.equal(hasConnectionFailure("sync-instagram.yml", `[error] ${error.message}`), false);
      return true;
    });
  }
});

after(closeBrowser);
async function fixture(html: (cookie: string, url: string) => string | { body: string; status?: number; contentType?: string; headers?: Record<string, string> }, action: () => Promise<void>) {
  const browser = await getBrowser();
  const original = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await original(...args);
    await context.route("**/*", (route) => {
      const response = html(route.request().headers().cookie ?? "", route.request().url());
      return route.fulfill({ contentType: "text/html; charset=utf-8", ...(typeof response === "string" ? { body: response } : response) });
    });
    return context;
  };
  try { await action(); } finally { browser.newContext = original; }
}
test("blank Instagram output is an error, not a healthy zero-post sync", async () => {
  await fixture(() => "<html><title>Instagram</title><body>Unavailable</body></html>", async () => {
    await assert.rejects(scrapeInstagramPosts("test"), /INSTAGRAM_EMPTY/);
  });
});
test("public login gate is reported without claiming an expired saved session", async () => {
  await fixture(() => "<html><title>Login • Instagram</title></html>", async () => {
    await assert.rejects(scrapeInstagramPosts("test"), (error: Error) => {
      assert.match(error.message, /INSTAGRAM_LOGIN_REQUIRED:/);
      assert.equal(hasConnectionFailure("sync-instagram.yml", `[error] ${error.message}`), false);
      return true;
    });
  });
});

test("saved-session login failure is retained when the public retry also requires login", async () => {
  let attempts = 0;
  await fixture(() => { attempts++; return "<title>Login • Instagram</title>"; }, async () => {
    await assert.rejects(scrapeInstagramPosts("test", "sessionid=expired"), (error: Error) => {
      assert.equal(hasConnectionFailure("sync-instagram.yml", `[error] ${error.message}`), true);
      return true;
    });
    assert.equal(attempts, 2);
  });
});

test("a rate-limited public retry stays a rate limit, not a session-expiry alert", async () => {
  let attempts = 0;
  await fixture((cookie) => {
    attempts++;
    return cookie.includes("sessionid=") ? "<title>Login • Instagram</title>" : { status: 429, headers: { "retry-after": "120" }, body: "Too Many Requests" };
  }, async () => {
    await assert.rejects(scrapeInstagramPosts("test", "sessionid=expired"), (error: Error) => {
      assert.match(error.message, /INSTAGRAM_HTTP_429:.*Retry-After=120/);
      assert.equal(hasConnectionFailure("sync-instagram.yml", `[error] ${error.message}`), false);
      return true;
    });
    assert.equal(attempts, 2);
  });
});

test("session verification cannot pass by silently retrying without the saved cookie", async () => {
  let attempts = 0;
  await fixture(() => { attempts++; return "<title>Login • Instagram</title>"; }, async () => {
    await assert.rejects(scrapeInstagramPosts("test", "sessionid=expired", 12, { allowPublicFallback: false }), /INSTAGRAM_SESSION_REJECTED:/);
    assert.equal(attempts, 1);
  });
});

test("feed API rate limits stop even when the profile document returned HTTP 200", async () => {
  await fixture((_cookie, url) => url.includes("/graphql/")
    ? { status: 429, body: "{}", contentType: "application/json", headers: { "retry-after": "60" } }
    : '<title>Instagram</title><script>fetch("/graphql/query")</script>', async () => {
    await assert.rejects(scrapeInstagramPosts("test", "sessionid=valid"), /INSTAGRAM_HTTP_429:.*Retry-After=60/);
  });
});

test("pagination preserves HTTP 429 instead of mislabeling status fail as a login error", async () => {
  const initial = { data: { user: { id: "123", edge_owner_to_timeline_media: { count: 2, edges: [], page_info: { has_next_page: true, end_cursor: "next" } } } } };
  let requests = 0;
  await fixture((_cookie, url) => {
    requests++;
    if (url.includes("/graphql/")) return { body: JSON.stringify(initial), contentType: "application/json" };
    if (url.includes("/api/v1/feed/")) return { status: 429, body: '{"status":"fail"}', contentType: "application/json", headers: { "retry-after": "90" } };
    return '<title>Instagram</title><script>fetch("/graphql/query")</script>';
  }, async () => {
    await assert.rejects(scrapeInstagramPosts("test", "sessionid=valid"), /INSTAGRAM_HTTP_429:.*Retry-After=90/);
    assert.equal(requests, 3);
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
