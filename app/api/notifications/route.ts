import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getExistingGuestKey } from "@/lib/community/guest-identity";
import {
  deleteCommunityNotifications,
  listCommunityNotifications,
  markCommunityNotificationRead,
  type NotificationRecipient,
} from "@/lib/notifications/community";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function currentRecipient(): Promise<NotificationRecipient | null> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  const guestKey = await getExistingGuestKey();
  return guestKey ? { guestKey } : null;
}

function notificationId(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.startsWith("community:") ? value.slice("community:".length) : value;
  return UUID_PATTERN.test(id) ? id : null;
}

export async function GET() {
  const recipient = await currentRecipient();
  const notifications = recipient ? await listCommunityNotifications(recipient) : [];
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const recipient = await currentRecipient();
  if (!recipient) return NextResponse.json({ error: "Notification identity is unavailable" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  const id = body?.all === true ? undefined : notificationId(body?.id);
  if (body?.all !== true && !id) return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  await markCommunityNotificationRead(recipient, id ?? undefined);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const recipient = await currentRecipient();
  if (!recipient) return NextResponse.json({ error: "Notification identity is unavailable" }, { status: 401 });
  const id = notificationId(new URL(request.url).searchParams.get("id"));
  const clearAll = new URL(request.url).searchParams.get("all") === "true";
  if (!clearAll && !id) return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  await deleteCommunityNotifications(recipient, clearAll ? undefined : id!);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
