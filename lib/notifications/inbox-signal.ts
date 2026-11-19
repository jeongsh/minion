import { createHmac } from "node:crypto";
import { notificationOwnerKey, type NotificationOwner } from "./community-recipients.ts";

// The topic is an opaque capability. Only send a wake-up signal on it.
// The actual inbox always requires the recipient's session or guest cookie.
export function inboxTopic(owner: NotificationOwner) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing inbox signing key");
  const digest = createHmac("sha256", key).update("minion:inbox:v1:" + notificationOwnerKey(owner)).digest("base64url");
  return "inbox-" + digest;
}

export async function signalInboxChanges(owners: NotificationOwner[]) {
  const topics = [...new Set(owners.map(inboxTopic))];
  for (let offset = 0; offset < topics.length; offset += 100) {
    const messages = topics.slice(offset, offset + 100).map(topic => ({
      topic, event: "inbox-changed", payload: { changed: true }, private: false,
    }));
    try {
      const response = await fetch(new URL("/realtime/v1/api/broadcast", process.env.NEXT_PUBLIC_SUPABASE_URL), {
        method: "POST",
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
    } catch (error) {
      // The rows have committed. Keep mobile push running; web readers reconcile on reconnect.
      console.warn("[inbox-signal] broadcast failed", error instanceof Error ? error.message : "network error");
    }
  }
}
