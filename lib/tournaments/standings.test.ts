import assert from "node:assert/strict";
import test from "node:test";

import { selectLckPomPointMatches } from "./standings.ts";
import type { Match } from "../types.ts";

function match(id: string): Match {
  return { id } as Match;
}

test("정규시즌 POM 포인트는 라운드 화면과 무관하게 1-4라운드를 누적한다", () => {
  const scopes = {
    cupRegularMatches: [match("cup")],
    rounds12Matches: [match("r12")],
    rounds34Matches: [match("r34")],
  };

  assert.deepEqual(selectLckPomPointMatches("2", scopes).map((item) => item.id), ["r12", "r34"]);
  assert.deepEqual(selectLckPomPointMatches("3", scopes).map((item) => item.id), ["r12", "r34"]);
});

test("LCK 컵 POM 포인트는 정규시즌과 분리한다", () => {
  const selected = selectLckPomPointMatches("1", {
    cupRegularMatches: [match("cup")],
    rounds12Matches: [match("r12")],
    rounds34Matches: [match("r34")],
  });

  assert.deepEqual(selected.map((item) => item.id), ["cup"]);
});
