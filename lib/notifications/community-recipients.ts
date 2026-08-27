export type NotificationOwner =
  | { userId: string; guestKey?: never }
  | { guestKey: string; userId?: never };

export type CommunityNotificationRecipient = {
  recipient: NotificationOwner;
  kind: "post_comment" | "comment_reply";
};

export function notificationOwnerKey(owner: NotificationOwner) {
  return owner.userId ? `user:${owner.userId}` : `guest:${owner.guestKey!}`;
}

export function communityNotificationRecipients(input: {
  actor: NotificationOwner;
  postOwner: NotificationOwner | null;
  parentOwner: NotificationOwner | null;
}): CommunityNotificationRecipient[] {
  const recipients = new Map<string, CommunityNotificationRecipient>();
  const actorKey = notificationOwnerKey(input.actor);
  const add = (recipient: NotificationOwner | null, kind: CommunityNotificationRecipient["kind"]) => {
    if (!recipient || notificationOwnerKey(recipient) === actorKey) return;
    const key = notificationOwnerKey(recipient);
    const existing = recipients.get(key);
    if (!existing || kind === "comment_reply") recipients.set(key, { recipient, kind });
  };
  add(input.postOwner, "post_comment");
  add(input.parentOwner, "comment_reply");
  return [...recipients.values()];
}
