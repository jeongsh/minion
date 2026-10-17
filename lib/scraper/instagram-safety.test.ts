import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { acquireInstagramRun, type ControlStore, type InstagramRun, type InstagramFailure } from "../sync/instagram-control.ts";
import { fetchInstagramGraphPosts } from "./instagram-graph.ts";
import { syncOwnerPosts, storeInstagramImage, InstagramSyncError } from "../sync/instagram.ts";
import { dispatchInstagramWorkflow, getMatchWorkflow, cancelMatchWorkflow } from "../sync/admin-match-workflow.ts";
import { GET as proxyImage } from "../../app/api/proxy/image/route.ts";

function credentials(t: TestContext) {
  for (const [key, value] of Object.entries({ INSTAGRAM_GRAPH_ACCESS_TOKEN: "fixture-secret", INSTAGRAM_GRAPH_USER_ID: "123", R2_SECRET_ACCESS_KEY: "fixture-r2" })) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
}

function memoryStore(): ControlStore {
  let saved: Awaited<ReturnType<ControlStore["read"]>> = null;
  let version = 0;
  return {
    async read() { return structuredClone(saved); },
    async write(state, etag) {
      if (saved?.etag !== etag) throw new Error("CAS conflict");
      saved = { state: structuredClone(state), etag: String(++version) };
      return saved.etag;
    },
  };
}

test("atomic lock rejects simultaneous runners and keeps cooldown after release", async t => {
  credentials(t);
  const store = memoryStore();
  let time = 1_000_000;
  const results = await Promise.allSettled([acquireInstagramRun(store, () => time), acquireInstagramRun(store, () => time)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const run = (results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<InstagramRun>).value;
  time += 26 * 60_000;
  assert.throws(() => run.beforeRequest(), /deadline/);
  await run.finish();
  await assert.rejects(acquireInstagramRun(store, () => time), /cooldown/);
  time += 60 * 60_000;
  const next = await acquireInstagramRun(store, () => time);
  await next.finish();
});

test("auth failure survives process restart until credential replacement; rate limit waits 24h", async t => {
  credentials(t);
  const store = memoryStore();
  let time = 1_000_000;
  const run = await acquireInstagramRun(store, () => time);
  await run.fail("auth");
  await run.finish();
  time += 2 * 24 * 60 * 60_000;
  await assert.rejects(acquireInstagramRun(store, () => time), /credentials are replaced/);
  process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN = "replacement";
  const replacement = await acquireInstagramRun(store, () => time);
  await replacement.fail("rate", 25 * 60 * 60_000);
  await replacement.finish();
  time += 24 * 60 * 60_000;
  await assert.rejects(acquireInstagramRun(store, () => time), /cooldown/);
});

test("lock storage failure fails closed", async t => {
  credentials(t);
  await assert.rejects(acquireInstagramRun({ async read() { throw new Error("offline"); }, async write() { throw new Error("must not write"); } }), /offline/);
});

for (const [status, kind] of [[401, "auth"], [403, "auth"], [429, "rate"], [500, "transient"]] as const) {
  test(`non-JSON HTTP ${status} stops after one official request`, async t => {
    credentials(t);
    let calls = 0;
    const failures: InstagramFailure[] = [];
    const run: InstagramRun = { beforeRequest() {}, async fail(k) { failures.push(k); }, async finish() {} };
    t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
      calls++;
      assert.equal(url.origin, "https://graph.facebook.com");
      assert.equal(url.searchParams.has("access_token"), false);
      assert.equal(new Headers(init.headers).has("cookie"), false);
      assert.equal(init.redirect, "error");
      return new Response("<html>upstream error</html>", { status });
    });
    await assert.rejects(fetchInstagramGraphPosts("t1lol", 60, run), /INSTAGRAM_GRAPH_STOP/);
    assert.equal(calls, 1);
    assert.deepEqual(failures, [kind]);
  });
}

test("high usage stops even on HTTP 200 and error diagnostics redact secrets", async t => {
  credentials(t);
  let blocked = "";
  const run: InstagramRun = { beforeRequest() {}, async fail(kind) { blocked = kind; }, async finish() {} };
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "fixture-secret https://example.com/?access_token=fixture-secret", fbtrace_id: "trace-1" } }, { headers: { "x-app-usage": '{"call_count":80}' } }));
  await assert.rejects(fetchInstagramGraphPosts("t1lol", 1, run), (error: Error) => {
    assert.ok(!error.message.includes("fixture-secret"));
    assert.match(error.message, /trace-1/);
    return true;
  });
  assert.equal(blocked, "rate");
});

const posts = Array.from({ length: 20 }, (_, i) => ({ id: String(i), permalink: `https://www.instagram.com/p/POST${i}/`, timestamp: "2026-10-18T00:00:00Z", media_type: "IMAGE" }));
test("page one is saved before page two failure; partial counts remain visible", async t => {
  credentials(t);
  let calls = 0;
  let saved = 0;
  const run: InstagramRun = { beforeRequest() {}, async fail() {}, async finish() {} };
  t.mock.method(globalThis, "fetch", async () => ++calls === 1
    ? Response.json({ business_discovery: { id: "456", media: { data: posts, paging: { cursors: { after: "next" } } } } })
    : new Response("failure", { status: 500 }));
  const db = { from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) }),
    upsert: () => ({ select: async () => ({ data: [{ id: String(++saved) }], error: null }) }),
  }) } as unknown as SupabaseClient;
  await assert.rejects(syncOwnerPosts(db, { kind: "team", id: "team", name: "T1", instagramUrl: "t1lol" }, { run, noNotify: true }), (error: Error) => {
    assert.ok(error instanceof InstagramSyncError);
    assert.equal(error.inserted, 20);
    assert.equal(error.checked, 20);
    return true;
  });
  assert.equal(saved, 20);
  assert.equal(calls, 2);
});

test("known page ends pagination and limits nested images", async t => {
  credentials(t);
  let calls = 0;
  const run: InstagramRun = { beforeRequest() {}, async fail() {}, async finish() {} };
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    calls++;
    assert.match(url.searchParams.get("fields")!, /children.limit\(1\)/);
    return Response.json({ business_discovery: { id: "456", media: { data: posts, paging: { cursors: { after: "next" } } } } });
  });
  const db = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: posts.map(p => ({ id: p.id, source_url: p.permalink })), error: null }) }) }) }) }) } as unknown as SupabaseClient;
  assert.equal((await syncOwnerPosts(db, { kind: "team", id: "team", name: "T1", instagramUrl: "t1lol" }, { run, dryRun: true })).checked, 20);
  assert.equal(calls, 1);
});

test("media downloader rejects pages, arbitrary hosts, and redirects without fallback", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    calls++;
    assert.equal(init.redirect, "error");
    assert.equal(init.headers, undefined);
    throw new Error("redirect");
  });
  for (const url of ["https://www.instagram.com/p/test/", "https://cdninstagram.com.evil.test/img.jpg", "http://cdninstagram.com/img.jpg"]) {
    await assert.rejects(storeInstagramImage("test", url), /non-CDN/);
  }
  assert.equal(calls, 0);
  assert.equal(await storeInstagramImage("test", ""), null);
  await assert.rejects(storeInstagramImage("test", "https://scontent.cdninstagram.com/img.jpg"), /INSTAGRAM_MEDIA_STOP/);
  assert.equal(calls, 1);
});

test("media repair database errors are not swallowed", async t => {
  credentials(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ business_discovery: { id: "456", media: { data: [posts[0]] } } }));
  const run: InstagramRun = { beforeRequest() {}, async fail() {}, async finish() {} };
  const db = { from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: [{ id: "1", source_url: posts[0].permalink, thumbnail_url: "https://expired.cdninstagram.com/image" }], error: null }) }) }) }),
    update: (row: { thumbnail_url: string | null }) => {
      assert.equal(row.thumbnail_url, null);
      return { eq: async () => ({ error: new Error("update denied") }) };
    },
  }) } as unknown as SupabaseClient;
  await assert.rejects(syncOwnerPosts(db, { kind: "team", id: "team", name: "T1", instagramUrl: "t1lol" }, { run }), /update denied/);
});

test("admin dispatches canonical workflow once and cancels the actual run", async t => {
  const original = { token: process.env.ADMIN_SCRIPTS_GITHUB_TOKEN, repo: process.env.ADMIN_SCRIPTS_GITHUB_REPOSITORY };
  process.env.ADMIN_SCRIPTS_GITHUB_TOKEN = "fixture-github";
  process.env.ADMIN_SCRIPTS_GITHUB_REPOSITORY = "2yongtech2/minion";
  t.after(() => {
    if (original.token === undefined) delete process.env.ADMIN_SCRIPTS_GITHUB_TOKEN; else process.env.ADMIN_SCRIPTS_GITHUB_TOKEN = original.token;
    if (original.repo === undefined) delete process.env.ADMIN_SCRIPTS_GITHUB_REPOSITORY; else process.env.ADMIN_SCRIPTS_GITHUB_REPOSITORY = original.repo;
  });
  let dispatches = 0;
  let cancels = 0;
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    assert.ok(input.startsWith("https://api.github.com/repos/2yongtech2/minion/actions/"));
    if (input.endsWith("/dispatches")) {
      dispatches++;
      assert.deepEqual(JSON.parse(String(init.body)), { ref: "main", inputs: { scope: "all", no_notify: "true" }, return_run_details: true });
      return Response.json({ workflow_run_id: 123, html_url: "https://github.com/2yongtech2/minion/actions/runs/123" });
    }
    if (input.endsWith("/cancel")) { cancels++; return new Response(null, { status: 202 }); }
    return Response.json({ path: ".github/workflows/sync-instagram.yml", status: "in_progress", conclusion: null, html_url: "https://github.com/2yongtech2/minion/actions/runs/123" });
  });
  await assert.rejects(dispatchInstagramWorkflow(["--full"]), /기본 수집/);
  assert.equal((await dispatchInstagramWorkflow([])).runId, 123);
  assert.equal((await getMatchWorkflow("123")).status, "in_progress");
  await cancelMatchWorkflow("123");
  assert.equal(dispatches, 1);
  assert.equal(cancels, 1);
});

test("public proxy never fetches Instagram pages or CDN URLs", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("must not fetch"); });
  for (const url of ["https://instagram.com/p/test/", "https://scontent.cdninstagram.com/photo.jpg", "https://external.test/photo.jpg"]) {
    assert.equal((await proxyImage(new Request(`https://minion.fan/api/proxy/image?url=${encodeURIComponent(url)}`))).status, 400);
  }
  assert.equal(calls, 0);
});
