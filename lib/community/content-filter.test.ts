import assert from "node:assert/strict";
import { test } from "node:test";

import { findProfanity, maskProfanity } from "./content-filter.ts";

test("명백한 쌍욕을 잡는다", () => {
  assert.equal(findProfanity("아 씨발 진짜"), "씨발");
  assert.equal(findProfanity("개새끼야 뭐하냐"), "개새끼");
  assert.equal(findProfanity("병신같은 밴픽"), "병신");
  assert.equal(findProfanity("좆같은 경기력"), "좆");
  assert.equal(findProfanity("염병하네"), "염병");
});

test("숫자·기호 끼워넣기 우회를 잡는다", () => {
  assert.equal(findProfanity("씨1발"), "씨발");
  assert.equal(findProfanity("씨.발 뭐냐"), "씨발");
  assert.equal(findProfanity("씨--발"), "씨발");
  assert.equal(findProfanity("개1새1끼"), "개새끼");
});

test("자모로만 된 표현은 허용한다", () => {
  assert.equal(findProfanity("ㅅㅂ 이게 맞냐"), null);
  assert.equal(findProfanity("진짜 ㅄ이네"), null);
  assert.equal(findProfanity("ㅈㄴ 못하네"), null);
  assert.equal(findProfanity("ㅈㄹ하네"), null);
});

test("시발은 문두/단독에서만 잡는다(왼쪽 한글 경계)", () => {
  assert.equal(findProfanity("시발 이게 맞냐"), "시발");
  assert.equal(findProfanity("와 시발"), "시발");
  // 앞말에 붙은 정상 조합은 통과.
  assert.equal(findProfanity("신작 출시발표 떴다"), null);
  assert.equal(findProfanity("다시발송 부탁드려요"), null);
});

test("금칙어를 포함하는 정상 단어는 통과한다", () => {
  assert.equal(findProfanity("이번 시즌의 시발점이 된 경기"), null);
  assert.equal(findProfanity("개발자 인터뷰 봤어?"), null);
  assert.equal(findProfanity("오늘 경기 정말 재밌었다"), null);
  assert.equal(findProfanity("ㅇㅅㅇ 귀엽다"), null);
});

test("마스킹은 첫 글자만 남긴다", () => {
  assert.equal(maskProfanity("씨발"), "씨*");
  assert.equal(maskProfanity("개새끼"), "개**");
  assert.equal(maskProfanity("좆"), "좆");
});
