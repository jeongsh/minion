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
