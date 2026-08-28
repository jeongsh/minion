// 커뮤니티 모더레이션 알림.
// 경기 자동화 알림(DISCORD_MATCH_WEBHOOK_URL)과 별개의 웹훅(DISCORD_COMMUNITY_WEBHOOK_URL)을 쓴다 —
// 웹훅을 다른 채널에 만들면 이름/아바타가 독립된 별도 봇이 된다.
// username 필드로 메시지 단위 봇 이름도 덮어쓴다(같은 웹훅을 재사용해도 "정화봇"으로 표시).

export type CommunityModerationDiscordEvent = {
  /** ai_blind=정화봇 자동 차단, report_blind=신고 누적 자동 블라인드. */
  kind: "ai_blind" | "report_blind";
  targetType: "post" | "comment";
  /** 글 제목 또는 댓글 요약(마스킹 전 원문 일부). */
  summary: string;
  /** 정화봇 차단 사유(카테고리·판정 이유) 또는 신고 정보. */
  reason?: string | null;
  /** 신고 누적 블라인드일 때 누적 신고 수. */
  reportCount?: number | null;
  /** 대상이 속한 글의 상세 경로(사이트 URL 뒤에 붙는 절대 경로). */
  postPath: string;
  /** 메시지에 표시할 봇 이름(예: "정화봇"). */
  botName: string;
};

function normalizedSiteUrl(siteUrl?: string) {
  const trimmed = siteUrl?.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export async function sendDiscordCommunityModerationAlert(
  webhookUrl: string,
  event: CommunityModerationDiscordEvent,
  siteUrl?: string,
): Promise<void> {
  const base = normalizedSiteUrl(siteUrl);
  const noun = event.targetType === "post" ? "게시글" : "댓글";
  const title = event.kind === "ai_blind"
    ? `${event.botName} 차단: ${noun}`
    : `신고 누적 블라인드: ${noun}`;

  const description = [
    event.summary,
    event.reason ? `사유: ${event.reason}` : null,
    event.kind === "report_blind" && event.reportCount
      ? `서로 다른 이용자 신고 ${event.reportCount}건 누적`
      : null,
    base ? `[어드민에서 처리](${base}/admin/community)` : null,
  ].filter(Boolean).join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: event.botName,
      allowed_mentions: { parse: [] },
      embeds: [{
        title,
        description,
        url: base ? `${base}${event.postPath}` : undefined,
        color: event.kind === "ai_blind" ? 0x8b5cf6 : 0xef4444,
        timestamp: new Date().toISOString(),
        footer: { text: "커뮤니티 자동 모더레이션 · Minion" },
      }],
    }),
  });

  if (!response.ok) {
    console.warn(`[discord] community moderation webhook failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
}

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
    | "set_data_sync_failed"
    | "set_data_sync_rate_limited";
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
  const isRateLimited = event.eventType === "set_data_sync_rate_limited";
  const isSet = event.eventType !== "match_completed";
  const base = normalizedSiteUrl(siteUrl);
  const matchUrl = base
    ? `${base}/matches/${encodeURIComponent(event.matchId)}${
        isSet && event.setNumber ? `?tab=rating&set=${event.setNumber}` : ""
      }`
    : undefined;

  const title = isRateLimited
    ? `Set ${event.setNumber ?? "?"} Leaguepedia 레이트 리밋`
    : isSyncSuccess
    ? `Set ${event.setNumber ?? "?"} 전체 데이터 동기화 성공`
    : isSyncFailure
      ? `Set ${event.setNumber ?? "?"} 데이터 동기화 실패`
      : event.eventType === "set_rating_opened"
        ? `Set ${event.setNumber ?? "?"} 팬 평점 오픈`
        : "경기 종료";
  const description = [
    event.matchName,
    `스코어 ${event.teamAScore} : ${event.teamBScore}`,
    isSyncSuccess ? `선수 데이터 ${event.playerStatsUpserted ?? 0}/10명 저장` : null,
    (isSyncFailure || isRateLimited) && event.error ? `오류: ${event.error}` : null,
    isRateLimited ? "10분 후 자동으로 다시 시도합니다." : null,
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
        color: isSyncFailure ? 0xef4444 : isRateLimited ? 0xf97316 : isSyncSuccess ? 0x3b82f6 : isSet ? 0x22c55e : 0xf59e0b,
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

export type FanHeaderRequestDiscordEvent = {
  teamName: string;
  teamSlug: string;
  requesterName: string;
  imageUrl: string;
  width: number;
  height: number;
  /** 요청자가 남긴 한 줄 설명. */
  caption?: string | null;
  /** 미처리 요청 누적 수(있으면 표시). */
  pendingCount?: number | null;
};

/**
 * 팬이 대문(헤더) 변경을 요청하면 운영진 채널로 알린다.
 * 커뮤니티 모더레이션과 같은 웹훅을 쓰되 username으로 봇 이름을 분리한다.
 */
export async function sendDiscordFanHeaderRequestAlert(
  webhookUrl: string,
  event: FanHeaderRequestDiscordEvent,
  siteUrl?: string,
): Promise<void> {
  const base = normalizedSiteUrl(siteUrl);
  const description = [
    `${event.requesterName}님이 ${event.teamName} 대문 변경을 요청했어요.`,
    event.caption ? `"${event.caption}"` : null,
    `이미지 ${event.width}×${event.height}`,
    event.pendingCount ? `미처리 요청 ${event.pendingCount}건` : null,
    base ? `[요청 검토하기](${base}/admin/fan-headers)` : null,
  ].filter(Boolean).join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "대문지기",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `대문 변경 요청: ${event.teamName}`,
        description,
        url: base ? `${base}/admin/fan-headers` : undefined,
        image: { url: event.imageUrl },
        color: 0x0ea5e9,
        timestamp: new Date().toISOString(),
        footer: { text: "팬 대문 요청 · Minion" },
      }],
    }),
  });

  if (!response.ok) {
    console.warn(`[discord] fan header request webhook failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
}

export type SupportInquiryDiscordEvent = {
  authorLabel: string;
  subject: string;
  /** 미리보기용 발췌(길면 잘라서 넘긴다). */
  excerpt: string;
  isPrivate: boolean;
  contactEmail?: string | null;
  pendingCount?: number | null;
};

/** 고객센터에 새 문의가 접수되면 운영 채널로 즉시 알린다. 커뮤니티 모더레이션과 같은 웹훅을 쓰되 username으로 봇 이름을 분리한다. */
export async function sendDiscordSupportInquiryAlert(
  webhookUrl: string,
  event: SupportInquiryDiscordEvent,
  siteUrl?: string,
): Promise<void> {
  const base = normalizedSiteUrl(siteUrl);
  const adminUrl = base ? `${base}/admin/support` : undefined;
  const description = [
    `${event.authorLabel}님이 문의를 남겼어요.`,
    event.isPrivate ? "🔒 비공개 문의" : null,
    event.excerpt,
    event.contactEmail ? `연락처: ${event.contactEmail}` : null,
    typeof event.pendingCount === "number" ? `미처리 문의 ${event.pendingCount}건` : null,
    adminUrl ? `[문의 확인하기](${adminUrl})` : null,
  ].filter(Boolean).join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "고객센터",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `새 문의: ${event.subject}`,
        description,
        url: adminUrl,
        color: 0x03de8a,
        timestamp: new Date().toISOString(),
        footer: { text: "고객센터 문의 · Minion" },
      }],
    }),
  });

  if (!response.ok) {
    console.warn(`[discord] support inquiry webhook failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
}

export type FanCalendarSubmissionDiscordEvent = {
  submissionId: string;
  teamName: string;
  teamSlug: string;
  requesterName: string;
  eventTypeLabel: string;
  title: string;
  eventDate: string;
  eventTime: string | null;
  isRecurring: boolean;
  description: string | null;
  sourceUrl: string;
  pendingCount: number | null;
};

export type FanCalendarDiscordDeliveryErrorCode =
  | "client_error"
  | "network"
  | "rate_limited"
  | "server_error"
  | "timeout";

export type FanCalendarDiscordDeliveryResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: FanCalendarDiscordDeliveryErrorCode;
      retryable: boolean;
      retryAfterSeconds: number | null;
    };

function discordPlainText(value: string, maxLength: number) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function retryAfterSeconds(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null;

  const numericSeconds = Number(value);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.max(1, Math.ceil(numericSeconds));
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt) || retryAt <= nowMs) return null;
  return Math.max(1, Math.ceil((retryAt - nowMs) / 1_000));
}

/** 팬 일정 제보를 운영 채널에 즉시 알린다. 웹훅 URL은 서버 환경변수로만 전달한다. */
export async function sendDiscordFanCalendarSubmissionAlert(
  webhookUrl: string,
  event: FanCalendarSubmissionDiscordEvent,
  siteUrl?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FanCalendarDiscordDeliveryResult> {
  const base = normalizedSiteUrl(siteUrl);
  const adminUrl = base ? `${base}/admin/calendar#calendar-submissions` : undefined;
  const description = [
    `${discordPlainText(event.requesterName, 60)}님이 ${discordPlainText(event.teamName, 40)} 일정을 제보했어요.`,
    `종류: ${discordPlainText(event.eventTypeLabel, 30)}`,
    `일시: ${event.eventDate}${event.eventTime ? ` ${event.eventTime}` : " · 종일"}${event.isRecurring ? " · 매년 반복" : ""}`,
    event.description ? `설명: ${discordPlainText(event.description, 500)}` : null,
    `출처: <${event.sourceUrl}>`,
    typeof event.pendingCount === "number" ? `미처리 제보 ${event.pendingCount}건` : null,
    adminUrl ? `[제보 검토하기](${adminUrl})` : null,
  ].filter(Boolean).join("\n");

  let response: Response;
  try {
    response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        username: "일정 제보 알림",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `일정 제보: ${discordPlainText(event.title, 80)}`,
          description,
          url: adminUrl,
          color: 0xf59e0b,
          timestamp: new Date().toISOString(),
          footer: { text: `팬 캘린더 제보 · ${event.submissionId.slice(0, 8)} · Minion` },
        }],
      }),
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    return {
      ok: false,
      errorCode: errorName === "AbortError" || errorName === "TimeoutError" ? "timeout" : "network",
      retryable: true,
      retryAfterSeconds: null,
    };
  }

  if (response.ok) return { ok: true };

  const parsedRetryAfter = retryAfterSeconds(response.headers.get("retry-after"));
  if (response.status === 429) {
    return { ok: false, errorCode: "rate_limited", retryable: true, retryAfterSeconds: parsedRetryAfter };
  }
  if (response.status === 408) {
    return { ok: false, errorCode: "timeout", retryable: true, retryAfterSeconds: parsedRetryAfter };
  }
  if (response.status >= 500) {
    return { ok: false, errorCode: "server_error", retryable: true, retryAfterSeconds: parsedRetryAfter };
  }
  return { ok: false, errorCode: "client_error", retryable: false, retryAfterSeconds: null };
}
