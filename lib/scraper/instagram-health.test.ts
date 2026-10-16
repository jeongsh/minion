import test from "node:test";
import assert from "node:assert/strict";
import { syncOwnerPosts } from "../sync/instagram.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchInstagramGraphPosts } from "./instagram-graph.ts";

test("official API failures stop without browser or cookie requests", async (t) => {
  const previous = { token: process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN, id: process.env.INSTAGRAM_GRAPH_USER_ID };
  process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN = "fixture-token";
  process.env.INSTAGRAM_GRAPH_USER_ID = "123";
  t.after(() => {
    if (previous.token === undefined) delete process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN; else process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN = previous.token;
    if (previous.id === undefined) delete process.env.INSTAGRAM_GRAPH_USER_ID; else process.env.INSTAGRAM_GRAPH_USER_ID = previous.id;
  });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.equal(url.searchParams.has("access_token"), false);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer fixture-token");
    assert.equal(headers.has("Cookie"), false);
    return Response.json({ error: { code: 190, error_subcode: 463 } }, { status: 401 });
  });
  await assert.rejects(fetchInstagramGraphPosts("t1lol", 1), (error: Error) => {
    assert.match(error.message, /INSTAGRAM_GRAPH_STOP:.*HTTP=401 code=190 subcode=463/);
    assert.ok(!error.message.includes("fixture-token"));
    return true;
  });
  assert.equal(requests, 1);
  await assert.rejects(fetchInstagramGraphPosts("unverified_account", 1), /INSTAGRAM_GRAPH_UNSUPPORTED:/);
  delete process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  await assert.rejects(fetchInstagramGraphPosts("t1lol", 1), /INSTAGRAM_GRAPH_CONFIG:/);
  assert.equal(requests, 1);
});

test("long captions cannot split an emoji into invalid JSON for Postgres", async (t) => {
  const caption = "a".repeat(199) + "🔥remaining caption";
  const previous = { token: process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN, id: process.env.INSTAGRAM_GRAPH_USER_ID };
  process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN = "fixture-token";
  process.env.INSTAGRAM_GRAPH_USER_ID = "123";
  t.after(() => {
    if (previous.token === undefined) delete process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN; else process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN = previous.token;
    if (previous.id === undefined) delete process.env.INSTAGRAM_GRAPH_USER_ID; else process.env.INSTAGRAM_GRAPH_USER_ID = previous.id;
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "graph.facebook.com");
    assert.match(url.searchParams.get("fields")!, /business_discovery.username\(t1lol\)/);
    return Response.json({ business_discovery: { id: "456", media: { data: [{
      id: "2", permalink: "https://www.instagram.com/p/EMOJI/",
      timestamp: "2026-09-10T00:00:00Z", media_type: "IMAGE", caption,
    }] } } });
  });
  let title = "";
  const database = { from: () => ({ upsert: (payload: { title: string }) => { title = payload.title; return { select: async () => ({ data: [], error: null }) }; } }) } as unknown as SupabaseClient;
  const result = await syncOwnerPosts(database, { kind: "team", id: "team", name: "T1", instagramUrl: "https://www.instagram.com/t1lol/" }, { noNotify: true });
  assert.equal(result.checked, 1);
  assert.equal(title, "a".repeat(199) + "🔥");
  assert.equal(title.isWellFormed(), true);
});
