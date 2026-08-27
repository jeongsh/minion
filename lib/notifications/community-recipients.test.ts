import assert from "node:assert/strict";
import test from "node:test";

import { communityNotificationRecipients, notificationOwnerKey } from "./community-recipients.ts";

test("새 댓글은 글 작성자에게만 알림을 보낸다", () => {
  assert.deepEqual(communityNotificationRecipients({
    actor: { userId: "actor" },
    postOwner: { userId: "post-owner" },
    parentOwner: null,
  }), [{ recipient: { userId: "post-owner" }, kind: "post_comment" }]);
});

test("글과 원댓글 작성자가 같으면 답글 알림 한 건으로 합친다", () => {
  assert.deepEqual(communityNotificationRecipients({
    actor: { guestKey: "actor-guest" },
    postOwner: { userId: "owner" },
    parentOwner: { userId: "owner" },
  }), [{ recipient: { userId: "owner" }, kind: "comment_reply" }]);
});

test("글 작성자와 원댓글 작성자가 다르면 각각 알림을 보낸다", () => {
  const recipients = communityNotificationRecipients({
    actor: { userId: "actor" },
    postOwner: { guestKey: "post-guest" },
    parentOwner: { userId: "comment-owner" },
  });
  assert.deepEqual(recipients.map((item) => [notificationOwnerKey(item.recipient), item.kind]), [
    ["guest:post-guest", "post_comment"],
    ["user:comment-owner", "comment_reply"],
  ]);
});

test("같은 비회원 신원에는 자기 활동 알림을 보내지 않는다", () => {
  assert.deepEqual(communityNotificationRecipients({
    actor: { guestKey: "same-device" },
    postOwner: { guestKey: "same-device" },
    parentOwner: null,
  }), []);
});

test("같은 기기여도 로그인 계정과 비회원 신원은 합치지 않는다", () => {
  const recipients = communityNotificationRecipients({
    actor: { userId: "signed-in" },
    postOwner: { guestKey: "same-device-guest" },
    parentOwner: null,
  });
  assert.equal(notificationOwnerKey(recipients[0].recipient), "guest:same-device-guest");
});
