import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMENT_DESKTOP_MAX_LENGTH,
  COMMENT_MOBILE_MAX_LENGTH,
  getCommentMaxLengthForRequest,
  getCommunityPostTextLength,
} from "./limits.ts";

test("comment limits distinguish mobile and desktop clients", () => {
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (Windows NT 10.0)"), COMMENT_DESKTOP_MAX_LENGTH);
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"), COMMENT_MOBILE_MAX_LENGTH);
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (Linux; Android 15)"), COMMENT_MOBILE_MAX_LENGTH);
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (Windows NT 10.0)", "?1"), COMMENT_MOBILE_MAX_LENGTH);
});

test("post text length counts rich-text text nodes and legacy text", () => {
  const richText = JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "안녕" }] },
      { type: "image", attrs: { src: "https://example.com/image.jpg" } },
      { type: "paragraph", content: [{ type: "text", text: "하세요" }] },
    ],
  });

  assert.equal(getCommunityPostTextLength(richText), 5);
  assert.equal(getCommunityPostTextLength("legacy text"), 11);
  assert.equal(getCommunityPostTextLength("123"), 3);
});
