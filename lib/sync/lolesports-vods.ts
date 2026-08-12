import type { SupabaseClient } from "@supabase/supabase-js";

// 롤이스포츠 웹 프론트엔드가 사용하는 공개 키. 비공식 API라 변경될 수 있고,
// 실패하더라도 수동 입력한 matches.vod_url 은 그대로 유지된다.
const LOLESPORTS_API = "https://esports-api.lolesports.com/persisted/gw";
const LOLESPORTS_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

export const LOLESPORTS_LEAGUE_IDS: Record<string, string> = {
  lck: "98767991310872058",
  lck_challengers: "98767991335774713",
  msi: "98767991325878492",
  worlds: "98767975604431411",
  first_stand: "113464388705111224",
  ewc: "116838530616006090",
  kespa_cup: "116929044967296666",
  wqs: "110988878756156222",
};

export type LolesportsEvent = {
  matchId: string;
  startTime: string;
  teamCodes: string[];
  league: string;
};

export type SetVod = {
  setNumber: number;
  provider: string;
  parameter: string;
  url: string;
  startSeconds: number | null;
};

type ScheduleResponse = {
  data?: {
    schedule?: {
      events?: Array<{
        startTime: string;
        state: string;
        match?: { id: string; teams?: Array<{ code: string }> };
      }>;
      pages?: { older?: string | null };
    };
  };
};

type EventDetailsResponse = {
  data?: {
    event?: {
      match?: {
        games?: Array<{
          number: number;
          state: string;
          vods?: Array<{
            locale: string;
            provider: string;
            parameter: string;
            startMillis: number | null;
          }>;
        }>;
      };
    };
  };
};

async function lolesportsApi<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${LOLESPORTS_API}/${path}`);
  url.search = new URLSearchParams({ hl: "ko-KR", ...params }).toString();

  const response = await fetch(url, {
    headers: { "x-api-key": LOLESPORTS_KEY },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`lolesports ${path} ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/** 숲 VOD 는 {url}/embed 로 iframe 임베드가 된다. 다른 제공처는 임베드하지 않는다. */
export function vodEmbedUrlFor(provider: string, url: string) {
  if (provider === "afreecatv") return `${url}/embed`;
  return null;
}

/** 숲 VOD 페이지의 og:image 에서 썸네일 주소를 읽는다. 실패하면 null. */
export async function fetchVodThumbnail(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; LCKHubMinion/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    return html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function vodUrlFor(provider: string, parameter: string) {
  if (provider === "afreecatv") return `https://vod.sooplive.com/player/${parameter}`;
  if (provider === "youtube") return `https://www.youtube.com/watch?v=${parameter}`;
  if (provider === "twitch") return `https://www.twitch.tv/videos/${parameter}`;
  return null;
}

export function dateKeyKST(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** 사이트 팀 약칭과 롤이스포츠 팀 코드가 다른 경우의 보정표. */
const TEAM_CODE_ALIASES: Record<string, string> = {
  BNF: "BFX",
};

export function normalizeTeamCode(code: string) {
  const upper = code.toUpperCase();
  return TEAM_CODE_ALIASES[upper] ?? upper;
}

export function matchKey(dateKey: string, codes: string[]) {
  return `${dateKey}|${[...codes].map(normalizeTeamCode).sort().join("_")}`;
}

/** 리그 하나의 완료된 경기를 과거 방향으로 페이지를 넘기며 수집한다. */
export async function collectLeagueEvents(
  league: string,
  leagueId: string,
  maxPages = 30,
  notBefore?: Date,
) {
  const events: LolesportsEvent[] = [];
  const seen = new Set<string>();
  let token: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const params: Record<string, string> = { leagueId };
    if (token) params.pageToken = token;

    const data = await lolesportsApi<ScheduleResponse>("getSchedule", params);
    const schedule = data.data?.schedule;
    let fresh = 0;

    for (const event of schedule?.events ?? []) {
      if (event.state !== "completed" || !event.match) continue;
      if (seen.has(event.match.id)) continue;
      seen.add(event.match.id);
      fresh += 1;
      events.push({
        matchId: event.match.id,
        startTime: event.startTime,
        teamCodes: (event.match.teams ?? []).map((team) => team.code),
        league,
      });
    }

    const completedTimes = (schedule?.events ?? [])
      .filter((event) => event.state === "completed")
      .map((event) => new Date(event.startTime).getTime())
      .filter(Number.isFinite);
    if (notBefore && completedTimes.length > 0 && Math.max(...completedTimes) < notBefore.getTime()) break;

    const older = schedule?.pages?.older;
    if (!older || (fresh === 0 && page > 0)) break;
    token = older;
  }

  return events;
}

/** 경기 하나의 세트별 한국어 VOD를 가져온다. 숲 우선, 없으면 유튜브. */
export async function fetchSetVods(lolesportsMatchId: string): Promise<SetVod[]> {
  const data = await lolesportsApi<EventDetailsResponse>("getEventDetails", { id: lolesportsMatchId });
  const games = data.data?.event?.match?.games ?? [];
  const result: SetVod[] = [];

  for (const game of games) {
    if (game.state !== "completed") continue;

    const korean = (game.vods ?? []).filter((vod) => vod.locale.toLowerCase().startsWith("ko"));
    const picked =
      korean.find((vod) => vod.provider === "afreecatv") ??
      korean.find((vod) => vod.provider === "youtube") ??
      korean[0];
    if (!picked) continue;

    const url = vodUrlFor(picked.provider, picked.parameter);
    if (!url) continue;

    result.push({
      setNumber: game.number,
      provider: picked.provider,
      parameter: picked.parameter,
      url,
      startSeconds: picked.startMillis === null ? null : Math.floor(picked.startMillis / 1000),
    });
  }

  return result;
}

export type LocalMatch = {
  id: string;
  matchDate: string;
  lolesportsMatchId: string | null;
  teamCodes: string[];
  label: string;
};

export async function loadLocalMatches(supabase: SupabaseClient): Promise<LocalMatch[]> {
  const [matchesResult, teamsResult] = await Promise.all([
    supabase
      .from("matches")
      .select("id, match_date, status, team_a_id, team_b_id, lolesports_match_id")
      .eq("status", "completed"),
    supabase.from("teams").select("id, name, short_name"),
  ]);

  if (matchesResult.error) throw matchesResult.error;
  if (teamsResult.error) throw teamsResult.error;

  const codeById = new Map(
    (teamsResult.data ?? []).map((team: { id: string; name: string | null; short_name: string | null }) => [
      team.id,
      (team.short_name ?? team.name ?? "").toUpperCase(),
    ]),
  );

  return (matchesResult.data ?? [])
    .map((match: {
      id: string;
      match_date: string;
      team_a_id: string | null;
      team_b_id: string | null;
      lolesports_match_id: string | null;
    }) => {
      const a = match.team_a_id ? codeById.get(match.team_a_id) ?? "" : "";
      const b = match.team_b_id ? codeById.get(match.team_b_id) ?? "" : "";
      return {
        id: match.id,
        matchDate: match.match_date,
        lolesportsMatchId: match.lolesports_match_id,
        teamCodes: [a, b].filter(Boolean),
        label: `${dateKeyKST(match.match_date)} ${a || "?"} vs ${b || "?"}`,
      };
    })
    .filter((match) => match.teamCodes.length === 2);
}
