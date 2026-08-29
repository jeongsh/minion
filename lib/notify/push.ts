// Expo Push API 클라이언트. expo-server-sdk 없이 문서화된 REST 엔드포인트를 직접 호출한다
// (이 프로젝트의 다른 외부 연동과 동일하게 raw fetch로 유지).
// https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: 'community' | 'content' | 'live' | 'match';
  sound?: 'default' | null;
};

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoPushResult = {
  /** DeviceNotRegistered 등으로 더 이상 유효하지 않은 토큰 — 호출부에서 DB에서 삭제해야 한다. */
  invalidTokens: string[];
  sent: number;
  failed: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { invalidTokens: [], sent: 0, failed: 0 };
  if (messages.length === 0) return result;

  for (const batch of chunk(messages, BATCH_SIZE)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch.map((message) => ({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data,
        channelId: message.channelId,
        sound: message.sound,
      }))),
    });

    if (!response.ok) {
      console.warn(`[push] Expo push API failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
      result.failed += batch.length;
      continue;
    }

    const body = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = body.data ?? [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        result.sent += 1;
        return;
      }
      result.failed += 1;
      if (ticket.details?.error === "DeviceNotRegistered") {
        result.invalidTokens.push(batch[index].to);
      }
    });
  }

  return result;
}
