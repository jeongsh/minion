import assert from "node:assert/strict";
import { test } from "node:test";

import { bindUrlCitationsToClaims, claimObjectRanges } from "./match-preview-citations.ts";

test("JSON 문자열 안의 claim 객체 범위를 문자열·중첩 배열과 무관하게 찾는다", () => {
  const output = JSON.stringify({
    claims: [
      { claim: "A {팀}의 평가", sourceUrls: ["https://a.example/news"] },
      { claim: "B팀의 평가", sourceUrls: ["https://b.example/news"] },
    ],
  });
  const ranges = claimObjectRanges(output);

  assert.equal(ranges.length, 2);
  assert.match(output.slice(ranges[0].start, ranges[0].end), /a\.example/);
  assert.match(output.slice(ranges[1].start, ranges[1].end), /b\.example/);
});

test("인용 위치가 들어 있는 claim에만 URL을 결합한다", () => {
  const output = JSON.stringify({
    claims: [
      { claim: "A팀 평가", sourceUrls: ["https://a.example/news"] },
      { claim: "B팀 평가", sourceUrls: ["https://b.example/news"] },
    ],
  });
  const aStart = output.indexOf("https://a.example/news");
  const bStart = output.indexOf("https://b.example/news");
  const bound = bindUrlCitationsToClaims(output, [
    { url: "https://a.example/news", start_index: aStart, end_index: aStart + 22 },
    { url: "https://b.example/news", start_index: bStart, end_index: bStart + 22 },
    { url: "https://unpositioned.example/news" },
  ]);

  assert.deepEqual(bound.map((rows) => rows.map((row) => row.url)), [
    ["https://a.example/news"],
    ["https://b.example/news"],
  ]);
});
