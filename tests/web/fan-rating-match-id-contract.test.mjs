import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(
  new URL("../../app/matches/[matchId]/page.tsx", import.meta.url),
  "utf8",
);

test("web rating submission uses the canonical database match id", () => {
  assert.match(
    pageSource,
    /<MatchRatingPanel[\s\S]*?matchId=\{match\.id\}[\s\S]*?routeMatchId=\{matchId\}/,
  );
  assert.match(pageSource, /<SetRatingForm[\s\S]*?matchId=\{matchId\}/);
});

test("web rating links preserve the requested route id", () => {
  assert.match(pageSource, /snapshotHref = `\/matches\/\$\{routeMatchId\}\/sets\/\$\{set\.id\}\/snapshot`/);
  assert.match(pageSource, /`\/matches\/\$\{routeMatchId\}\?tab=rating&set=\$\{set\.id\}`/);
});
