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

  const embeds = notifications.map((n) => ({
    title: `${n.ownerKind === "player" ? "🎮" : "🏆"} ${n.ownerName} — 새 스토리 ${n.newCount}개`,
    url: n.instagramUrl.startsWith("http") ? n.instagramUrl : `https://www.instagram.com/${n.instagramUrl.replace(/^@/, "")}/`,
    color: n.ownerKind === "player" ? 0xe1306c : 0x833ab4,
    thumbnail: n.thumbnailUrl ? { url: n.thumbnailUrl } : undefined,
    footer: { text: "Instagram Stories • Minion" },
    timestamp: new Date().toISOString(),
  }));

  // Discord: 최대 10 embeds per request
  for (let i = 0; i < embeds.length; i += 10) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: embeds.slice(i, i + 10) }),
    });
    if (!res.ok) {
      console.warn(`[discord] webhook 실패: ${res.status} ${await res.text()}`);
    }
  }
}

export type MatchAutomationDiscordEvent = {
  eventType: "set_rating_opened" | "match_completed";
  matchId: string;
  matchName: string;
  setNumber?: number | null;
  teamAScore: number;
  teamBScore: number;
};

export async function sendDiscordMatchAutomationAlert(
  webhookUrl: string,
  event: MatchAutomationDiscordEvent,
  siteUrl?: string,
): Promise<void> {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");

  const isSet = event.eventType === "set_rating_opened";
  const matchUrl = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/matches/${encodeURIComponent(event.matchId)}${
        isSet && event.setNumber ? `?tab=rating&set=${event.setNumber}` : ""
      }`
    : undefined;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: isSet
            ? `Set ${event.setNumber ?? "?"} 팬 평점 오픈`
            : "경기 종료",
          description: `${event.matchName}\n스코어 ${event.teamAScore} : ${event.teamBScore}`,
          url: matchUrl,
          color: isSet ? 0x22c55e : 0xf59e0b,
          timestamp: new Date().toISOString(),
          footer: { text: "LCKHub Minion 자동 감지" },
        },
      ],
    }),
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const details = (await response.text()).slice(0, 500);
    throw new Error(
      `Discord webhook failed (${response.status})${
        retryAfter ? `; retry-after=${retryAfter}` : ""
      }: ${details}`,
    );
  }
}
