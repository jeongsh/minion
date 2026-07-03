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

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    cache: "no-store",
    headers: { "User-Agent": "LCKHub-Minion/0.1 (+https://lolesports.com)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`LoL Esports live stats failed (${response.status})`);
  return (await response.json()) as T;
}

export async function fetchLolesportsGameData(
  gameId: string,
  observedAt = new Date(),
  fetchImpl: typeof fetch = fetch,
) {
  const encodedId = encodeURIComponent(gameId);
  const startingTime = encodeURIComponent(observedAt.toISOString());
  const [initialWindow, finalWindow, details] = await Promise.all([
    fetchJson<LiveWindowPayload>(`${LIVE_STATS_BASE}/window/${encodedId}`, fetchImpl),
    fetchJson<LiveWindowPayload>(`${LIVE_STATS_BASE}/window/${encodedId}?startingTime=${startingTime}`, fetchImpl),
    fetchJson<LiveDetailsPayload>(`${LIVE_STATS_BASE}/details/${encodedId}?startingTime=${startingTime}`, fetchImpl),
  ]);
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
