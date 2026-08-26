import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMENT_DESKTOP_MAX_LENGTH,
  COMMENT_MOBILE_MAX_LENGTH,
  getCommentMaxLengthForRequest,
  getCommunityPostTextLength,
  getGuestPostAttachmentError,
} from "./limits.ts";

test("comment limits distinguish mobile and desktop clients", () => {
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (Windows NT 10.0)"), COMMENT_DESKTOP_MAX_LENGTH);
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"), COMMENT_MOBILE_MAX_LENGTH);
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (Linux; Android 15)"), COMMENT_MOBILE_MAX_LENGTH);
  assert.equal(getCommentMaxLengthForRequest("Mozilla/5.0 (Windows NT 10.0)", "?1"), COMMENT_MOBILE_MAX_LENGTH);
});

test("guest posts allow one image and polls but reject extra images and embeds", () => {
  const document = (content: Array<Record<string, unknown>>) => JSON.stringify({ type: "doc", content });
  assert.equal(getGuestPostAttachmentError(document([
    { type: "imageResize", attrs: { src: "/one.webp" } },
    { type: "poll", attrs: { pollId: "poll" } },
  ])), null);
  assert.equal(getGuestPostAttachmentError(document([
    { type: "image", attrs: { src: "/one.webp" } },
    { type: "image", attrs: { src: "/two.webp" } },
  ])), "비회원은 게시글에 이미지를 1장까지 첨부할 수 있습니다.");
  assert.equal(getGuestPostAttachmentError(document([
    { type: "youtube", attrs: { src: "https://youtube.com/embed/example" } },
  ])), "YouTube와 SNS 첨부는 로그인 후 사용할 수 있습니다.");
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
