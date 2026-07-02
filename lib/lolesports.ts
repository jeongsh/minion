export const LOLESPORTS_GRAPHQL_ENDPOINT = "https://lolesports.com/api/gql";
export const LCK_LEAGUE_ID = "98767991310872058";
export const DEFAULT_TRACKED_LEAGUE_IDS = [
  LCK_LEAGUE_ID,
  "98767991325878492", // MSI
  "98767975604431411", // Worlds
  "113464388705111224", // First Stand
] as const;

// Verified against the lolesports.com APQ manifest on 2026-07-01.
const DEFAULT_HOME_EVENTS_APQ_HASH =
  "7246add6f577cf30b304e651bf9e25fc6a41fe49aeafb0754c16b5778060fc0a";

export type LolesportsState = "unstarted" | "inProgress" | "completed";
export type LolesportsGameState = LolesportsState | "unneeded";

export type LolesportsTeam = {
  id: string;
  name: string;
  code: string;
  result: {
    gameWins: number;
    outcome: "win" | "loss" | "tie" | null;
  };
};

export type LolesportsEvent = {
  id: string;
  startTime: string;
  state: LolesportsState;
  league: { id: string; slug: string; name: string };
  matchTeams: LolesportsTeam[];
  match: {
    id: string;
    state: LolesportsState;
    strategy: { type: "bestOf" | "playAll"; count: number };
    games: Array<{ id: string; number: number; state: LolesportsGameState }>;
  };
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
    "match" in event &&
    Array.isArray(event.matchTeams) &&
    event.matchTeams.length === 2 &&
    Array.isArray(event.match.games)
  );
}
