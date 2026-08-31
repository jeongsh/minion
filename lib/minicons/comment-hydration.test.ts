import assert from "node:assert/strict";
import test from "node:test";

import { resolveRenderableCommentMinicons } from "./comment-hydration.ts";

test("공개 종료된 미니콘도 저장된 댓글에서는 계속 렌더링한다", () => {
  const minicons = resolveRenderableCommentMinicons([
    { id: "published-item", packId: "published-pack", name: "공개", imageUrl: "/published.png" },
    { id: "retired-item", packId: "retired-pack", name: "종료", imageUrl: "/retired.png" },
  ], [
    { id: "published-pack", name: "공개 팩", status: "published" },
    { id: "retired-pack", name: "종료 팩", status: "retired" },
  ]);

  assert.deepEqual([...minicons.keys()], ["published-item", "retired-item"]);
  assert.equal(minicons.get("retired-item")?.packName, "종료 팩");
});

test("정지·심사·반려 패키지는 저장된 댓글에서도 숨긴다", () => {
  const minicons = resolveRenderableCommentMinicons([
    { id: "suspended-item", packId: "suspended-pack", name: "정지", imageUrl: "/suspended.png" },
    { id: "pending-item", packId: "pending-pack", name: "심사", imageUrl: "/pending.png" },
    { id: "rejected-item", packId: "rejected-pack", name: "반려", imageUrl: "/rejected.png" },
  ], [
    { id: "suspended-pack", name: "정지 팩", status: "suspended" },
    { id: "pending-pack", name: "심사 팩", status: "pending_review" },
    { id: "rejected-pack", name: "반려 팩", status: "rejected" },
  ]);

  assert.equal(minicons.size, 0);
});
