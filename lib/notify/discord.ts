export interface StoryNotification {
  ownerName: string;
  ownerKind: "player" | "team";
  instagramUrl: string;
  newCount: number;
  thumbnailUrl?: string;
}

export async function sendDiscordStoryAlert(
  webhookUrl: string,
  notifications: StoryNotification[],
): Promise<void> {
  if (notifications.length === 0) return;

  const embeds = notifications.map((notification) => ({
    title: `${notification.ownerKind === "player" ? "선수" : "팀"} ${notification.ownerName} 새 스토리 ${notification.newCount}개`,
    url: notification.instagramUrl.startsWith("http")
      ? notification.instagramUrl
      : `https://www.instagram.com/${notification.instagramUrl.replace(/^@/, "")}/`,
    color: notification.ownerKind === "player" ? 0xe1306c : 0x833ab4,
    thumbnail: notification.thumbnailUrl ? { url: notification.thumbnailUrl } : undefined,
    footer: { text: "Instagram Stories · Minion" },
    timestamp: new Date().toISOString(),
  }));

  for (let index = 0; index < embeds.length; index += 10) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: embeds.slice(index, index + 10) }),
    });
    if (!response.ok) {
      console.warn(`[discord] webhook failed: ${response.status} ${await response.text()}`);
    }
  }
}

export type MatchAutomationDiscordEvent = {
  eventType:
    | "set_rating_opened"
    | "match_completed"
    | "set_data_sync_succeeded"
    | "set_data_sync_failed";
  matchId: string;
  matchName: string;
  setNumber?: number | null;
  teamAScore: number;
  teamBScore: number;
  playerStatsUpserted?: number | null;
  error?: string | null;
};

export async function sendDiscordMatchAutomationAlert(
  webhookUrl: string,
  event: MatchAutomationDiscordEvent,
  siteUrl?: string,
): Promise<void> {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");

  const isSyncSuccess = event.eventType === "set_data_sync_succeeded";
  const isSyncFailure = event.eventType === "set_data_sync_failed";
  const isSet = event.eventType !== "match_completed";
  const matchUrl = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/matches/${encodeURIComponent(event.matchId)}${
        isSet && event.setNumber ? `?tab=rating&set=${event.setNumber}` : ""
      }`
    : undefined;

  const title = isSyncSuccess
    ? `Set ${event.setNumber ?? "?"} 데이터 동기화 성공`
    : isSyncFailure
      ? `Set ${event.setNumber ?? "?"} 데이터 동기화 실패`
      : event.eventType === "set_rating_opened"
        ? `Set ${event.setNumber ?? "?"} 팬 평점 오픈`
        : "경기 종료";
  const description = [
    event.matchName,
    `스코어 ${event.teamAScore} : ${event.teamBScore}`,
    isSyncSuccess ? `선수 데이터 ${event.playerStatsUpserted ?? 0}/10명 저장` : null,
    isSyncFailure && event.error ? `오류: ${event.error}` : null,
  ].filter(Boolean).join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title,
        description,
        url: matchUrl,
        color: isSyncFailure ? 0xef4444 : isSyncSuccess ? 0x3b82f6 : isSet ? 0x22c55e : 0xf59e0b,
        timestamp: new Date().toISOString(),
        footer: { text: "LCKHub Minion 자동 감지" },
      }],
    }),
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const details = (await response.text()).slice(0, 500);
    throw new Error(
      `Discord webhook failed (${response.status})${retryAfter ? `; retry-after=${retryAfter}` : ""}: ${details}`,
    );
  }
}
