import assert from "node:assert/strict";
import test from "node:test";

import { selectBestComments } from "./best-comments.ts";

const candidate = (overrides: Partial<Parameters<typeof selectBestComments>[0][number]> & { id: string }) => ({
  blindedAt: null,
  createdAt: "2026-08-27T00:00:00.000Z",
  deletedAt: null,
  dislikeCount: 0,
  likeCount: 5,
  parentId: null,
  ...overrides,
});

test("베스트 댓글은 순추천과 좋아요 순으로 최대 3개를 고른다", () => {
  const selected = selectBestComments([
    candidate({ id: "older", likeCount: 8, dislikeCount: 2 }),
    candidate({ id: "top", likeCount: 9, dislikeCount: 1 }),
    candidate({ id: "more-likes", likeCount: 9, dislikeCount: 3 }),
    candidate({ id: "fourth", likeCount: 6, dislikeCount: 1 }),
  ]);

  assert.deepEqual(selected.map((comment) => comment.id), ["top", "more-likes", "older"]);
});

test("답글과 삭제·블라인드·기준 미달 댓글은 제외한다", () => {
  const selected = selectBestComments([
    candidate({ id: "reply", parentId: "root" }),
    candidate({ id: "deleted", deletedAt: "2026-08-27T00:00:00.000Z" }),
    candidate({ id: "blinded", blindedAt: "2026-08-27T00:00:00.000Z" }),
    candidate({ id: "few-likes", likeCount: 4 }),
    candidate({ id: "low-net", likeCount: 7, dislikeCount: 5 }),
    candidate({ id: "best", likeCount: 7, dislikeCount: 2 }),
  ]);

  assert.deepEqual(selected.map((comment) => comment.id), ["best"]);
});
