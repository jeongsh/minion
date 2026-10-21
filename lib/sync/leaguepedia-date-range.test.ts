import assert from "node:assert/strict";
import test from "node:test";

import { leaguepediaKstDateRange } from "./leaguepedia-date-range.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cursorWithLookback, syncLeaguepediaLck2026 } from "./leaguepedia-lck-2026.ts";
import { resetLeaguepediaSessionForTests } from "./leaguepedia-api.ts";
import { SEASON_2026_TOURNAMENTS } from "../tournaments/season-2026.ts";

test("converts inclusive KST calendar dates to a UTC half-open range", () => {
  assert.deepEqual(leaguepediaKstDateRange("2026-07-28", "2026-07-30"), {
    startIso: "2026-07-27T15:00:00.000Z",
    endExclusiveIso: "2026-07-30T15:00:00.000Z",
  });
});

test("rejects reversed and overly long ranges", () => {
  assert.throws(
    () => leaguepediaKstDateRange("2026-07-30", "2026-07-28"),
    /종료일/,
  );
  assert.throws(
    () => leaguepediaKstDateRange("2026-01-01", "2026-02-01"),
    /최대 31일/,
  );
});

test("moves the incremental cursor back by the configured overlap", () => {
  assert.equal(
    cursorWithLookback("2026-07-30T08:00:00.000Z", 3),
    "2026-07-27T08:00:00.000Z",
  );
  assert.equal(cursorWithLookback(null, 3), null);
});

test("scheduled sync resolves renamed teams and stops before fixture writes on an unknown team", async (t) => {
  const previousUsername = process.env.LEAGUEPEDIA_BOT_USERNAME;
  const previousPassword = process.env.LEAGUEPEDIA_BOT_PASSWORD;
  process.env.LEAGUEPEDIA_BOT_USERNAME = "test";
  process.env.LEAGUEPEDIA_BOT_PASSWORD = "test";
  resetLeaguepediaSessionForTests();
  t.after(() => {
    if (previousUsername === undefined) delete process.env.LEAGUEPEDIA_BOT_USERNAME;
    else process.env.LEAGUEPEDIA_BOT_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.LEAGUEPEDIA_BOT_PASSWORD;
    else process.env.LEAGUEPEDIA_BOT_PASSWORD = previousPassword;
    resetLeaguepediaSessionForTests();
  });
  const worlds = SEASON_2026_TOURNAMENTS.find((item) => item.segmentKey === "worlds")!;
  const rows = [
    { MatchId: "slot-4", MatchDateTime: "2026-10-23 20:00:00", Team1: "Anyone's Legend", Team2: "Karmine Corp", OverviewPage: worlds.overviewPage },
    { MatchId: "slot-7", MatchDateTime: "2026-10-23 23:00:00", Team1: "LØS", Team2: "T1", OverviewPage: worlds.overviewPage },
  ];
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const params = init?.method === "POST" ? new URLSearchParams(String(init.body)) : new URL(String(input)).searchParams;
    if (params.get("action") === "login") return Response.json({ login: { result: "Success" } });
    if (params.get("meta") === "tokens") return Response.json({ query: { tokens: { logintoken: "test" } } });
    return Response.json({ cargoquery: rows.map((title) => ({ title })) });
  });
  const teams = [
    { id: "al", slug: "agal", name: "AG.AL", short_name: "AL", leaguepedia_page: "AG.AL" },
    { id: "ml", slug: "mibrlos", name: "MIBR.LOS", short_name: "ML", leaguepedia_page: "MIBR.LOS" },
    { id: "kc", slug: "karmine-corp", name: "Karmine Corp", short_name: "KC" },
    { id: "t1", slug: "t1", name: "T1", short_name: "T1" },
  ];
  const aliases = [{ team_id: "al", page_name: "Anyone's Legend" }, { team_id: "ml", page_name: "LØS" }];
  const updates: Array<Record<string, unknown>> = [];
  const supabase = {
    from(table: string) {
      let patch: Record<string, unknown> | undefined;
      const filters = new Map<string, unknown>();
      const execute = (single = false) => {
        if (patch) {
          if (table === "matches") updates.push({ ...patch, id: filters.get("id") });
          return { data: single ? { id: table } : null, error: null };
        }
        const data = table === "teams" ? teams : table === "leaguepedia_team_aliases" ? aliases
          : [{ id: table === "matches" ? filters.get("leaguepedia_match_id") : table }];
        return { data: single ? data[0] : data, error: null };
      };
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.set(key, value); return query; },
        update(value: Record<string, unknown>) { patch = value; return query; },
        maybeSingle() { return Promise.resolve(execute(true)); },
        single() { return Promise.resolve(execute(true)); },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(execute()).then(resolve); },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  const options = { mode: "full" as const, tournaments: [worlds] };
  const summary = await syncLeaguepediaLck2026(supabase, options);
  assert.equal(summary.matchesUpdated, 2);
  assert.equal(summary.matchesCreated, 0);
  assert.deepEqual(updates.map((row) => [row.id, row.team_a_id, row.team_b_id]), [["slot-4", "al", "kc"], ["slot-7", "ml", "t1"]]);
  updates.length = 0;
  rows[1].Team1 = "Unknown renamed team";
  await assert.rejects(syncLeaguepediaLck2026(supabase, options), /Unknown renamed team/);
  assert.equal(updates.length, 0, "even the first resolvable fixture must remain untouched");
});
