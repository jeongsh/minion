import type { MobileCommunityNotificationsDto } from "@/packages/contracts/src/mobile-v1";
import { getMobileCommunityActor } from "@/lib/mobile/community";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import {
  deleteCommunityNotifications,
  listCommunityNotifications,
  markCommunityNotificationRead,
  type NotificationRecipient,
} from "@/lib/notifications/community";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function currentRecipient(request: Request): Promise<NotificationRecipient> {
  const actor = await getMobileCommunityActor(request);
  return actor.auth ? { userId: actor.auth.user.id } : { guestKey: actor.guest.key };
}

function notificationId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.startsWith("community:") ? value.slice("community:".length) : value;
  return UUID_PATTERN.test(id) ? id : null;
}

export async function GET(request: Request) {
  try {
    const notifications = await listCommunityNotifications(await currentRecipient(request));
    return mobileSuccess<MobileCommunityNotificationsDto>({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "알림을 불러오지 못했습니다.", 500);
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  const id = body?.all === true ? undefined : notificationId(body?.id);
  if (body?.all !== true && !id) return mobileError("BAD_REQUEST", "알림 정보가 올바르지 않습니다.", 400);
  try {
    await markCommunityNotificationRead(await currentRecipient(request), id ?? undefined);
    return mobileSuccess({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "알림을 변경하지 못했습니다.", 500);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = notificationId(url.searchParams.get("id"));
  const clearAll = url.searchParams.get("all") === "true";
  if (!clearAll && !id) return mobileError("BAD_REQUEST", "알림 정보가 올바르지 않습니다.", 400);
  try {
    await deleteCommunityNotifications(await currentRecipient(request), clearAll ? undefined : id!);
    return mobileSuccess({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "알림을 삭제하지 못했습니다.", 500);
  }
}
