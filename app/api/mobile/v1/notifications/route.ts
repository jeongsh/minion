import type { MobileCommunityNotificationsDto } from "@/packages/contracts/src/mobile-v1";
import { getMobileCommunityActor } from "@/lib/mobile/community";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import {
  deleteCommunityNotifications,
  listCommunityNotifications,
  markCommunityNotificationRead,
  type NotificationRecipient,
} from "@/lib/notifications/community";
import {
  deleteTeamContentNotifications,
  listTeamContentNotifications,
  markTeamContentNotificationRead,
} from "@/lib/notifications/team-content-inbox";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function currentRecipient(request: Request): Promise<NotificationRecipient> {
  const actor = await getMobileCommunityActor(request);
  return actor.auth ? { userId: actor.auth.user.id } : { guestKey: actor.guest.key };
}

function notificationId(value: unknown): { id: string; scope: "community" | "content" } | null {
  if (typeof value !== "string") return null;
  const scope = value.startsWith("community:") ? "community" : value.startsWith("content:") ? "content" : null;
  if (!scope) return null;
  const id = value.slice(scope.length + 1);
  return UUID_PATTERN.test(id) ? { id, scope } : null;
}

export async function GET(request: Request) {
  try {
    const recipient = await currentRecipient(request);
    const notifications = (await Promise.all([
      listCommunityNotifications(recipient),
      recipient.userId ? listTeamContentNotifications(recipient.userId) : Promise.resolve([]),
    ])).flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100);
    return mobileSuccess<MobileCommunityNotificationsDto>({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "알림을 불러오지 못했습니다.", 500);
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  const parsedId = body?.all === true ? undefined : notificationId(body?.id);
  if (body?.all !== true && !parsedId) return mobileError("BAD_REQUEST", "알림 정보가 올바르지 않습니다.", 400);
  try {
    const recipient = await currentRecipient(request);
    if (!parsedId) {
      await Promise.all([
        markCommunityNotificationRead(recipient),
        recipient.userId ? markTeamContentNotificationRead(recipient.userId) : Promise.resolve(),
      ]);
    } else if (parsedId.scope === "community") {
      await markCommunityNotificationRead(recipient, parsedId.id);
    } else if (recipient.userId) {
      await markTeamContentNotificationRead(recipient.userId, parsedId.id);
    } else {
      return mobileError("BAD_REQUEST", "알림 정보가 올바르지 않습니다.", 400);
    }
    return mobileSuccess({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "알림을 변경하지 못했습니다.", 500);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsedId = notificationId(url.searchParams.get("id"));
  const clearAll = url.searchParams.get("all") === "true";
  if (!clearAll && !parsedId) return mobileError("BAD_REQUEST", "알림 정보가 올바르지 않습니다.", 400);
  try {
    const recipient = await currentRecipient(request);
    if (clearAll) {
      await Promise.all([
        deleteCommunityNotifications(recipient),
        recipient.userId ? deleteTeamContentNotifications(recipient.userId) : Promise.resolve(),
      ]);
    } else if (parsedId!.scope === "community") {
      await deleteCommunityNotifications(recipient, parsedId!.id);
    } else if (recipient.userId) {
      await deleteTeamContentNotifications(recipient.userId, parsedId!.id);
    } else {
      return mobileError("BAD_REQUEST", "알림 정보가 올바르지 않습니다.", 400);
    }
    return mobileSuccess({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "알림을 삭제하지 못했습니다.", 500);
  }
}
