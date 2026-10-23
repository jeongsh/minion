import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";
import { parseLeaguepediaEarlyStatDiffs, parseLeaguepediaTimelineEvents } from "./leaguepedia-timeline.ts";
import type { CargoBriefingRow, LeaguepediaBriefingRows } from "../match-briefing-data.ts";

const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

async function request(params: Record<string, string>) {
  const pending = queue.then(async () => {
    const delay = Math.max(0, lastRequest + 3000 - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequest = Date.now();
    const response = await fetchAuthenticatedLeaguepediaApi(new URLSearchParams({ format: "json", ...params }));
    if (!response.ok) throw new Error(`Leaguepedia briefing: HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`Leaguepedia briefing: ${JSON.stringify(body.error)}`);
    return body;
  });
  queue = pending.catch(() => undefined);
  return pending;
}

async function cargo(params: Record<string, string>): Promise<CargoBriefingRow[]> {
  const rows: CargoBriefingRow[] = [];
  const limit = Number(params.limit ?? 500);
  for (let offset = 0; ; offset += limit) {
    const body = await request({ action: "cargoquery", limit: String(limit), ...params, offset: String(offset) });
    const batch = (body.cargoquery ?? []).map((item: { title: CargoBriefingRow }) => item.title);
    rows.push(...batch);
    if (batch.length < limit || params.limit) return rows;
  }
}

type TimelineFrame = NonNullable<Parameters<typeof parseLeaguepediaTimelineEvents>[0]["frames"]>[number];

/** 플랫폼 ID가 확인된 세트의 실제 타임라인을 묶어서 읽는다. 없는 페이지는 결과에서 제외한다. */
export async function fetchBriefingTimelines(pages: Array<{ gameId: string; title: string }>) {
  const result = new Map<string, TimelineFrame[]>();
  for (let index = 0; index < pages.length; index += 5) {
    const batch = pages.slice(index, index + 5);
    const body = await request({ action: "query", titles: batch.map((row) => row.title).join("|"), prop: "revisions", rvprop: "content", rvslots: "main" });
    for (const page of Object.values(body.query?.pages ?? {}) as Array<{ title: string; revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }>) {
      const gameId = batch.find((row) => row.title.replace(/_/g, " ") === page.title.replace(/_/g, " "))?.gameId;
      const content = page.revisions?.[0]?.slots?.main?.["*"];
      if (!gameId || !content) continue;
      const timeline = JSON.parse(content) as { frames?: TimelineFrame[] };
      if (timeline.frames?.length) result.set(gameId, timeline.frames);
    }
  }
  return result;
}
const positions = ["Top", "Jungle", "Mid", "Bot", "Support"];

export function addBriefingTimelineMetrics(rows: CargoBriefingRow[], frames: TimelineFrame[]) {
  // Riot participant IDs 1..5 are blue TOP..SUP; 6..10 are red TOP..SUP,
  // matching the existing Leaguepedia timeline synchronizer.
  for (const row of rows) {
    const role = positions.findIndex((position) => position.toLowerCase() === row.Role?.toLowerCase());
    const side = row.Side === "1" ? "blue" : row.Side === "2" ? "red" : row.Side?.toLowerCase();
    if (role < 0 || (side !== "blue" && side !== "red")) continue;
    const metrics = parseLeaguepediaEarlyStatDiffs({ frames }, role + 1 + (side === "red" ? 5 : 0));
    for (const minute of [10, 15] as const) {
      for (const [field, key] of [["gold", "Gold"], ["xp", "Xp"]] as const) {
        const value = metrics[`${field}_diff_at_${minute}`];
        if (value != null) row[`${key}DiffAt${minute}`] = String(value);
      }
    }
  }
}

export async function fetchBriefingGameTimelines(games: CargoBriefingRow[]) {
  if (!games.length) return new Map<string, TimelineFrame[]>();
  const metadata = await cargo({ tables: "PostgameJsonMetadata", fields: "GameId=GameId,TimelinePage=TimelinePage",
    where: `GameId IN (${games.map((game) => `"${escape(game.GameId!)}"`).join(",")})`, order_by: "GameId" });
  const pages = games.flatMap((game) => {
    const title = metadata.find((row) => row.GameId === game.GameId)?.TimelinePage
      || (game.RiotPlatformGameId ? `V5 data:${game.RiotPlatformGameId.replace(/_/g, " ")}/Timeline` : null);
    if (!title) return [];
    game.TimelinePage = title;
    return [{ gameId: game.GameId!, title }];
  });
  return fetchBriefingTimelines(pages);
}

/** LCK 세트 동기화와 같은 타임라인 이벤트에서 진영별 첫 원소 드래곤 시각을 구한다. */
export function addBriefingTimelineObjectives(game: CargoBriefingRow, frames: TimelineFrame[]) {
  const participants = new Map(Array.from({ length: 10 }, (_, index) =>
    [index + 1, { playerId: String(index + 1), teamId: index < 5 ? "blue" : "red" }] as const));
  const events = parseLeaguepediaTimelineEvents({ frames }, game.GameId!, "blue", "red", participants);
  for (const side of ["blue", "red"] as const) {
    const times = events.filter((event) => event.event_type === "ELITE_MONSTER_KILL" && event.team_id === side
      && (event.monster_type === "DRAGON" || event.monster_type?.endsWith("_DRAGON")) && event.monster_type !== "ELDER_DRAGON"
      && Number.isFinite(event.timestamp_ms) && event.timestamp_ms >= 0).map((event) => event.timestamp_ms);
    if (times.length) game[side === "blue" ? "BlueFirstDragonMs" : "RedFirstDragonMs"] = String(Math.min(...times));
  }
}

/** 최근 경기부터 세트 수를 누적해 minSets를 처음 채우는 지점까지만 남긴다. */
export function trimBriefingMatchesToSets(matches: CargoBriefingRow[], minSets: number) {
  let sets = 0;
  const kept: CargoBriefingRow[] = [];
  for (const match of matches) {
    if (sets >= minSets) break;
    kept.push(match);
    sets += (Number(match.Team1Score) || 0) + (Number(match.Team2Score) || 0);
  }
  return kept;
}

/** Authenticated read-only supplement. Cache only the small normalized rows in the caller. */
export async function fetchLeaguepediaBriefingRows(teamPage: string | string[], cutoff: string, minSets = 0): Promise<LeaguepediaBriefingRows> {
  const names = (Array.isArray(teamPage) ? teamPage : [teamPage]).map((name) => `"${escape(name)}"`).join(",");
  const before = new Date(Math.min(Date.parse(cutoff), Date.now())).toISOString().slice(0, 19).replace("T", " ");
  const scheduled = await cargo({ tables: "MatchSchedule=MS", limit: minSets > 0 ? "30" : "5",
    fields: "MS.MatchId=MatchId,MS.DateTime_UTC=MatchDateTime,MS.Team1=Team1,MS.Team2=Team2,MS.Team1Score=Team1Score,MS.Team2Score=Team2Score,MS.Winner=Winner,MS.OverviewPage=OverviewPage",
    where: `(MS.Team1 IN (${names}) OR MS.Team2 IN (${names})) AND MS.DateTime_UTC<"${before}" AND (MS.Winner="1" OR MS.Winner="2") AND (MS.FF IS NULL OR MS.FF="" OR MS.FF="0")`,
    order_by: "MS.DateTime_UTC DESC" });
  const matches = minSets > 0 ? trimBriefingMatchesToSets(scheduled, minSets) : scheduled;
  if (!matches.length) return { matches, games: [], players: [] };
  const ids = matches.map((match) => `"${escape(match.MatchId!)}"`).join(",");
  const result: LeaguepediaBriefingRows = { matches, games: [], players: [] };
  try {
    const games = await cargo({ tables: "ScoreboardGames=SG",
      fields: ["MatchId", "GameId", "RiotPlatformGameId", "MatchHistory", "N_GameInMatch", "Team1", "Team2", "Winner", "Gamelength", "Team1Kills", "Team2Kills", "Team1Gold", "Team2Gold", "Team1Dragons", "Team2Dragons", "Team1Barons", "Team2Barons", "Team1Towers", "Team2Towers", "Patch"].map((field) => `SG.${field}=${field}`).join(","),
      where: `SG.MatchId IN (${ids})`, order_by: "SG.GameId" });
    result.games = games;
    const players = await cargo({ tables: "ScoreboardPlayers=SP",
      fields: ["GameId", "Link", "Champion", "Team", "Role", "Side", "Kills", "Deaths", "Assists", "CS", "Gold", "DamageToChampions", "VisionScore"].map((field) => `SP.${field}=${field}`).join(","),
      where: `SP.MatchId IN (${ids})`, order_by: "SP.GameId,SP.Link" });
    result.players = players;
    if (!games.length) return result;
    // Box scores lack GD10/15 and XPD10/15. Read their actual timeline snapshots as well.
    const timelines = await fetchBriefingGameTimelines(games);
    for (const [gameId, frames] of timelines) {
      addBriefingTimelineMetrics(players.filter((row) => row.GameId === gameId), frames);
      addBriefingTimelineObjectives(games.find((row) => row.GameId === gameId)!, frames);
    }
  } catch (error) {
    // Keep verified results and box scores even when optional timeline data is unavailable.
    console.warn(`[match-briefing] ${names} 상세 지표 보충 실패`, error);
  }
  return result;
}

/** Leaguepedia Teams.Region을 팀 페이지별로 읽는다. 페이지가 없거나 지역이 비면 결과에서 빠진다. */
export async function fetchLeaguepediaTeamRegions(pages: string[]) {
  const regions = new Map<string, string>();
  for (let index = 0; index < pages.length; index += 40) {
    const batch = pages.slice(index, index + 40);
    const rows = await cargo({ tables: "Teams", fields: "OverviewPage=OverviewPage,Region=Region",
      where: `OverviewPage IN (${batch.map((page) => `"${escape(page)}"`).join(",")})` });
    for (const row of rows) if (row.OverviewPage && row.Region) regions.set(row.OverviewPage, row.Region);
  }
  return regions;
}
