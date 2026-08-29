import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getExistingGuestKey } from "@/lib/community/guest-identity";
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

async function currentRecipient(): Promise<NotificationRecipient | null> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  const guestKey = await getExistingGuestKey();
  return guestKey ? { guestKey } : null;
}

function notificationId(value: unknown): { id: string; scope: "community" | "content" } | null {
  if (typeof value !== "string") return null;
  const scope = value.startsWith("community:") ? "community" : value.startsWith("content:") ? "content" : null;
  if (!scope) return null;
  const id = value.slice(scope.length + 1);
  return UUID_PATTERN.test(id) ? { id, scope } : null;
}

export async function GET() {
  const recipient = await currentRecipient();
  const notifications = recipient
    ? (await Promise.all([
        listCommunityNotifications(recipient),
        recipient.userId ? listTeamContentNotifications(recipient.userId) : Promise.resolve([]),
      ])).flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100)
    : [];
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const recipient = await currentRecipient();
  if (!recipient) return NextResponse.json({ error: "Notification identity is unavailable" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  const parsedId = body?.all === true ? undefined : notificationId(body?.id);
  if (body?.all !== true && !parsedId) return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
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
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const recipient = await currentRecipient();
  if (!recipient) return NextResponse.json({ error: "Notification identity is unavailable" }, { status: 401 });
  const parsedId = notificationId(new URL(request.url).searchParams.get("id"));
  const clearAll = new URL(request.url).searchParams.get("all") === "true";
  if (!clearAll && !parsedId) return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
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
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
