export const LOLESPORTS_GRAPHQL_ENDPOINT = "https://lolesports.com/api/gql";
export const LCK_LEAGUE_ID = "98767991310872058";
export const DEFAULT_TRACKED_LEAGUE_IDS = [
  LCK_LEAGUE_ID,
  "98767991325878492", // MSI
  "98767975604431411", // Worlds
  "113464388705111224", // First Stand
  "116838530616006090", // EWC (Esports World Cup)
] as const;

// Verified against the lolesports.com APQ manifest on 2026-07-01.
const DEFAULT_HOME_EVENTS_APQ_HASH =
  "7246add6f577cf30b304e651bf9e25fc6a41fe49aeafb0754c16b5778060fc0a";

export type LolesportsState = "unstarted" | "inProgress" | "completed";
export type LolesportsGameState = LolesportsState | "unneeded";

export type LolesportsTeam = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  result?: {
    gameWins?: number | null;
    outcome?: "win" | "loss" | "tie" | null;
  } | null;
};

export type LolesportsEvent = {
  id?: string | null;
  startTime?: string | null;
  state?: LolesportsState | null;
  league?: { id?: string | null; slug?: string | null; name?: string | null } | null;
  matchTeams?: Array<LolesportsTeam | null> | null;
  match?: {
    id?: string | null;
    state?: LolesportsState | null;
    strategy?: { type?: "bestOf" | "playAll" | null; count?: number | null } | null;
    games?: Array<{
      id?: string | null;
      number?: number | null;
      state?: LolesportsGameState | null;
    } | null> | null;
  } | null;
};

type HomeEventsResponse = {
  data?: {
    esports?: {
      events?: Array<LolesportsEvent | { id: string }>;
    } | null;
  };
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

export async function fetchTrackedLolesportsEvents({
  start,
  end,
  fetchImpl = fetch,
}: {
  start: Date;
  end: Date;
  fetchImpl?: typeof fetch;
}): Promise<LolesportsEvent[]> {
  const configuredLeagueIds = process.env.LOLESPORTS_LEAGUE_IDS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const body = {
    operationName: "homeEvents",
    variables: {
      hl: "ko-KR",
      sport: ["lol"],
      leagues:
        configuredLeagueIds?.length ? configuredLeagueIds : [...DEFAULT_TRACKED_LEAGUE_IDS],
      eventDateStart: start.toISOString(),
      eventDateEnd: end.toISOString(),
      eventState: ["unstarted", "inProgress", "completed"],
      eventType: "match",
      pageSize: 40,
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          process.env.LOLESPORTS_HOME_EVENTS_APQ_HASH ?? DEFAULT_HOME_EVENTS_APQ_HASH,
      },
    },
  };

  const response = await fetchImpl(LOLESPORTS_GRAPHQL_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "LCKHub-Minion/0.1 (+https://lolesports.com)",
      "apollographql-client-name": "LCKHub Minion",
      "apollographql-client-version": "0.1.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  const payload = (await response.json().catch(() => null)) as HomeEventsResponse | null;

  if (!response.ok || payload?.errors?.length) {
    const details = payload?.errors
      ?.map((error) => `${error.extensions?.code ?? "API_ERROR"}: ${error.message ?? "unknown error"}`)
      .join("; ");
    throw new Error(
      `LoL Esports API failed (${response.status}): ${details ?? "invalid JSON response"}. ` +
        "If the APQ id changed, update LOLESPORTS_HOME_EVENTS_APQ_HASH from the current lolesports.com manifest.",
    );
  }

  const events = payload?.data?.esports?.events ?? [];
  return events.filter(isLolesportsMatchEvent);
}

function isLolesportsMatchEvent(event: LolesportsEvent | { id: string }): event is LolesportsEvent {
  return (
    "match" in event && Boolean(event.match) &&
    Array.isArray(event.matchTeams) &&
    event.matchTeams.length === 2 &&
    Array.isArray(event.match?.games)
  );
}
