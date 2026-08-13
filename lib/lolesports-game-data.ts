const LIVE_STATS_BASE = "https://feed.lolesports.com/livestats/v1";

type NullableNumber = number | null | undefined;

export type LiveParticipantMetadata = {
  participantId?: number | null;
  esportsPlayerId?: string | null;
  summonerName?: string | null;
  championId?: string | null;
  role?: string | null;
};

export type LiveTeamMetadata = {
  esportsTeamId?: string | null;
  participantMetadata?: Array<LiveParticipantMetadata | null> | null;
};

export type LiveWindowParticipant = {
  participantId?: number | null;
  totalGold?: number | null;
  level?: number | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  creepScore?: number | null;
};

export type LiveWindowTeam = {
  totalGold?: number | null;
  inhibitors?: number | null;
  towers?: number | null;
  barons?: number | null;
  totalKills?: number | null;
  dragons?: Array<string | null> | null;
  participants?: Array<LiveWindowParticipant | null> | null;
};

export type LiveWindowFrame = {
  rfc460Timestamp?: string | null;
  gameState?: string | null;
  blueTeam?: LiveWindowTeam | null;
  redTeam?: LiveWindowTeam | null;
};

export type LiveDetailParticipant = {
  participantId?: number | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  totalGoldEarned?: number | null;
  creepScore?: number | null;
  championDamageShare?: number | null;
  wardsPlaced?: number | null;
  wardsDestroyed?: number | null;
  items?: Array<number | null> | null;
  perkMetadata?: {
    styleId?: number | null;
    subStyleId?: number | null;
    perks?: Array<number | null> | null;
  } | null;
};

export type LiveDetailFrame = {
  rfc460Timestamp?: string | null;
  participants?: Array<LiveDetailParticipant | null> | null;
};

export type LiveWindowPayload = {
  gameMetadata?: {
    patchVersion?: string | null;
    blueTeamMetadata?: LiveTeamMetadata | null;
    redTeamMetadata?: LiveTeamMetadata | null;
  } | null;
  frames?: Array<LiveWindowFrame | null> | null;
};

export type LiveDetailsPayload = {
  frames?: Array<LiveDetailFrame | null> | null;
};

export type LolesportsGameData = {
  patch: string | null;
  durationSeconds: number | null;
  blueTeam: LiveWindowTeam | null;
  redTeam: LiveWindowTeam | null;
  blueTeamMetadata: LiveTeamMetadata | null;
  redTeamMetadata: LiveTeamMetadata | null;
  participants: Array<{
    metadata: LiveParticipantMetadata;
    window: LiveWindowParticipant | null;
    detail: LiveDetailParticipant | null;
    side: "blue" | "red";
  }>;
};

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function latestFrame<T extends { rfc460Timestamp?: string | null }>(frames: Array<T | null> | null | undefined) {
  return (frames ?? []).filter((frame): frame is T => Boolean(frame)).sort(
    (a, b) => (timestamp(b.rfc460Timestamp) ?? -1) - (timestamp(a.rfc460Timestamp) ?? -1),
  )[0] ?? null;
}

function firstTimestamp(frames: Array<{ rfc460Timestamp?: string | null } | null> | null | undefined) {
  const values = (frames ?? []).flatMap((frame) => {
    const value = timestamp(frame?.rfc460Timestamp);
    return value === null ? [] : [value];
  });
  return values.length ? Math.min(...values) : null;
}

function positiveNumber(value: NullableNumber) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseLolesportsGameData(
  initialWindow: LiveWindowPayload,
  finalWindow: LiveWindowPayload,
  details: LiveDetailsPayload,
): LolesportsGameData {
  const windowFrame = latestFrame(finalWindow.frames);
  const detailFrame = latestFrame(details.frames);
  const metadata = finalWindow.gameMetadata ?? initialWindow.gameMetadata ?? null;
  const startedAt = firstTimestamp(initialWindow.frames);
  const endedAt = timestamp(windowFrame?.rfc460Timestamp);
  const durationSeconds = startedAt !== null && endedAt !== null && endedAt >= startedAt
    ? Math.round((endedAt - startedAt) / 1000)
    : null;
  const detailByParticipant = new Map(
    (detailFrame?.participants ?? []).flatMap((participant) =>
      participant && typeof participant.participantId === "number"
        ? [[participant.participantId, participant] as const]
        : [],
    ),
  );
  const windowByParticipant = new Map(
    [
      ...(windowFrame?.blueTeam?.participants ?? []),
      ...(windowFrame?.redTeam?.participants ?? []),
    ].flatMap((participant) =>
      participant && typeof participant.participantId === "number"
        ? [[participant.participantId, participant] as const]
        : [],
    ),
  );

  const participantRows = ([
    ["blue", metadata?.blueTeamMetadata],
    ["red", metadata?.redTeamMetadata],
  ] as const).flatMap(([side, team]) =>
    (team?.participantMetadata ?? []).flatMap((participant) =>
      participant && typeof participant.participantId === "number"
        ? [{
            metadata: participant,
            window: windowByParticipant.get(participant.participantId) ?? null,
            detail: detailByParticipant.get(participant.participantId) ?? null,
            side,
          }]
        : [],
    ),
  );

  const patchParts = metadata?.patchVersion?.match(/^(\d+)\.(\d+)/);
  const patchMajor = patchParts ? Number(patchParts[1]) : null;
  return {
    patch: patchParts && patchMajor !== null
      ? `${patchMajor < 20 ? patchMajor + 10 : patchMajor}.${patchParts[2]}`
      : null,
    durationSeconds,
    blueTeam: windowFrame?.blueTeam ?? null,
    redTeam: windowFrame?.redTeam ?? null,
    blueTeamMetadata: metadata?.blueTeamMetadata ?? null,
    redTeamMetadata: metadata?.redTeamMetadata ?? null,
    participants: participantRows.map((row) => ({
      ...row,
      window: row.window ? {
        ...row.window,
        totalGold: positiveNumber(row.window.totalGold),
      } : null,
    })),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// feed.lolesports.com은 비공식 API라 정상적인 요청에도 이따금 네트워크 오류나 5xx를
// 준다(같은 요청을 잠시 후 다시 보내면 대부분 성공한다). 하나의 라이브 조회는 walk
// 하나당 요청을 여러 번 보내므로, 각 요청 단위로 재시도하지 않으면 그중 한 번만
// 흔들려도 전체 조회가 실패한다. 400(더 볼 데이터 없음)은 재시도 대상이 아니다.
async function fetchLiveStats(url: string, fetchImpl: typeof fetch): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        cache: "no-store",
        headers: { "User-Agent": "LCKHub-Minion/0.1 (+https://lolesports.com)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 400 || response.ok) return response;
      lastError = new Error(`LoL Esports live stats failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await sleep(400 * (attempt + 1));
  }
  throw lastError;
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchLiveStats(url, fetchImpl);
  if (!response.ok) throw new Error(`LoL Esports live stats failed (${response.status})`);
  return (await response.json()) as T;
}

function liveStatsCursor(value: number) {
  return new Date(Math.ceil(value / 10_000) * 10_000).toISOString();
}

async function fetchWindowPage(
  url: string,
  fetchImpl: typeof fetch,
): Promise<LiveWindowPayload | null> {
  const response = await fetchLiveStats(url, fetchImpl);
  if (response.status === 400) return null;
  if (!response.ok) throw new Error(`LoL Esports live stats failed (${response.status})`);
  return (await response.json()) as LiveWindowPayload;
}

// Live Stats only returns a short page of frames per request (starting from the
// requested cursor, or from the very beginning of the game when no cursor is given),
// and rejects a cursor that lands past the data it has published so far with HTTP 400.
// For a game still in progress, a single fixed-size hop (e.g. always +10 minutes) can
// overshoot what's published and get rejected on the very first try, which looks
// identical to "we've reached the true end" — leaving the walk stuck on the initial
// page forever. Back off to smaller hops instead of giving up on the first 400, so the
// walk still converges to the latest available frame for a live game, not just a
// finished one.
const WALK_STEP_MS = [10 * 60_000, 5 * 60_000, 2 * 60_000, 60_000, 30_000, 10_000];
const MAX_WALK_HOPS = 40;

async function findFinalWindow(
  gameId: string,
  initialWindow: LiveWindowPayload,
  fetchImpl: typeof fetch,
) {
  let best = initialWindow;
  let bestTimestamp = timestamp(latestFrame(initialWindow.frames)?.rfc460Timestamp);
  if (bestTimestamp === null) return initialWindow;

  for (let hop = 0; hop < MAX_WALK_HOPS; hop += 1) {
    let advanced = false;
    for (const step of WALK_STEP_MS) {
      const cursor = liveStatsCursor(bestTimestamp + step);
      const next = await fetchWindowPage(
        `${LIVE_STATS_BASE}/window/${gameId}?startingTime=${encodeURIComponent(cursor)}`,
        fetchImpl,
      );
      if (!next) continue; // this hop size overshot the published data — try a smaller one
      const nextTimestamp = timestamp(latestFrame(next.frames)?.rfc460Timestamp);
      if (nextTimestamp === null || nextTimestamp <= bestTimestamp) continue;
      best = next;
      bestTimestamp = nextTimestamp;
      advanced = true;
      break;
    }
    if (!advanced) break; // even the smallest hop didn't move forward — truly caught up
  }
  return best;
}

// details는 window보다 발행이 늦다 — window가 이미 "지금"이라고 본 시점을 그대로
// details에 요청하면, details는 아직 그 시점 데이터를 안 올린 상태라 400을 준다.
// window 워크와 같은 원리로, 커서를 조금씩 과거로 물러나며 details가 실제로 받아줄
// 때까지 재시도한다.
const DETAILS_BACKOFF_MS = [0, 10_000, 30_000, 60_000, 120_000];

async function fetchLatestDetails(
  gameId: string,
  finalTimestamp: number | null,
  fetchImpl: typeof fetch,
): Promise<LiveDetailsPayload> {
  if (finalTimestamp === null) {
    return fetchJson<LiveDetailsPayload>(`${LIVE_STATS_BASE}/details/${gameId}`, fetchImpl);
  }
  for (const backoff of DETAILS_BACKOFF_MS) {
    const cursor = liveStatsCursor(finalTimestamp - backoff);
    const response = await fetchLiveStats(
      `${LIVE_STATS_BASE}/details/${gameId}?startingTime=${encodeURIComponent(cursor)}`,
      fetchImpl,
    );
    if (response.status === 400) continue; // 이 시점 데이터가 아직 없음 — 더 과거로 물러나 재시도
    if (!response.ok) throw new Error(`LoL Esports live stats failed (${response.status})`);
    return (await response.json()) as LiveDetailsPayload;
  }
  // 그래도 안 되면 커서 없이(가장 이른 페이지) 마지막으로 시도한다.
  return fetchJson<LiveDetailsPayload>(`${LIVE_STATS_BASE}/details/${gameId}`, fetchImpl);
}

export async function fetchLolesportsGameData(
  gameId: string,
  _observedAt = new Date(),
  fetchImpl: typeof fetch = fetch,
) {
  void _observedAt;
  const encodedId = encodeURIComponent(gameId);
  const initialWindow = await fetchJson<LiveWindowPayload>(
    `${LIVE_STATS_BASE}/window/${encodedId}`,
    fetchImpl,
  );
  const finalWindow = await findFinalWindow(encodedId, initialWindow, fetchImpl);
  const finalTimestamp = timestamp(latestFrame(finalWindow.frames)?.rfc460Timestamp);
  const details = await fetchLatestDetails(encodedId, finalTimestamp, fetchImpl);
  return parseLolesportsGameData(initialWindow, finalWindow, details);
}

export function dragonCounts(dragons: Array<string | null> | null | undefined) {
  const counts = new Map<string, number>();
  for (const dragon of dragons ?? []) {
    if (!dragon) continue;
    const key = dragon.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    total: [...counts.values()].reduce((sum, value) => sum + value, 0),
    clouds: counts.get("cloud") ?? 0,
    infernals: counts.get("infernal") ?? 0,
    mountains: counts.get("mountain") ?? 0,
    oceans: counts.get("ocean") ?? 0,
    hextechs: counts.get("hextech") ?? 0,
    chemtechs: counts.get("chemtech") ?? 0,
    elders: counts.get("elder") ?? 0,
  };
}
