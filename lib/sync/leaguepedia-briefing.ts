import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";
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
  const body = await request({ action: "cargoquery", limit: "500", ...params });
  return (body.cargoquery ?? []).map((item: { title: CargoBriefingRow }) => item.title);
}

type TimelineFrame = { timestamp: number; participantFrames?: Record<string, { totalGold?: number; xp?: number }> };
const positions = ["Top", "Jungle", "Mid", "Bot", "Support"];

export function addBriefingTimelineMetrics(rows: CargoBriefingRow[], frames: TimelineFrame[]) {
  // Riot participant IDs 1..5 are blue TOP..SUP; 6..10 are red TOP..SUP,
  // matching the existing Leaguepedia timeline synchronizer.
  for (const minute of [10, 15]) {
    // Riot snapshots drift by a few milliseconds (e.g. 600096 at minute 10).
    const frame = frames.find((item) => item.timestamp >= minute * 60_000 && item.timestamp < minute * 60_000 + 5000);
    if (!frame?.participantFrames) continue;
    for (const row of rows) {
      const role = positions.findIndex((position) => position.toLowerCase() === row.Role?.toLowerCase());
      const side = row.Side === "1" ? "blue" : row.Side === "2" ? "red" : row.Side?.toLowerCase();
      if (role < 0 || (side !== "blue" && side !== "red")) continue;
      const id = role + 1 + (side === "red" ? 5 : 0);
      const opponentId = role + 1 + (side === "red" ? 0 : 5);
      const own = frame.participantFrames[String(id)], opponent = frame.participantFrames[String(opponentId)];
      if (!own || !opponent) continue;
      if (typeof own.totalGold === "number" && typeof opponent.totalGold === "number") row[`GoldDiffAt${minute}`] = String(own.totalGold - opponent.totalGold);
      if (typeof own.xp === "number" && typeof opponent.xp === "number") row[`XpDiffAt${minute}`] = String(own.xp - opponent.xp);
    }
  }
}

/** Authenticated read-only supplement. Cache only the small normalized rows in the caller. */
export async function fetchLeaguepediaBriefingRows(teamPage: string, cutoff: string): Promise<LeaguepediaBriefingRows> {
  const before = new Date(Math.min(Date.parse(cutoff), Date.now())).toISOString().slice(0, 19).replace("T", " ");
  const matches = await cargo({ tables: "MatchSchedule=MS", limit: "5",
    fields: "MS.MatchId=MatchId,MS.DateTime_UTC=MatchDateTime,MS.Team1=Team1,MS.Team2=Team2,MS.Team1Score=Team1Score,MS.Team2Score=Team2Score,MS.Winner=Winner,MS.OverviewPage=OverviewPage",
    where: `(MS.Team1="${escape(teamPage)}" OR MS.Team2="${escape(teamPage)}") AND MS.DateTime_UTC<"${before}" AND (MS.Winner="1" OR MS.Winner="2") AND (MS.FF IS NULL OR MS.FF="" OR MS.FF="0")`,
    order_by: "MS.DateTime_UTC DESC" });
  if (!matches.length) return { matches, games: [], players: [] };
  const ids = matches.map((match) => `"${escape(match.MatchId!)}"`).join(",");
  const result: LeaguepediaBriefingRows = { matches, games: [], players: [] };
  try {
    const games = await cargo({ tables: "ScoreboardGames=SG",
      fields: ["MatchId", "GameId", "N_GameInMatch", "Team1", "Team2", "Winner", "Gamelength", "Team1Kills", "Team2Kills", "Team1Gold", "Team2Gold", "Team1Dragons", "Team2Dragons", "Team1Barons", "Team2Barons", "Team1Towers", "Team2Towers", "Patch"].map((field) => `SG.${field}=${field}`).join(","),
      where: `SG.MatchId IN (${ids})` });
    result.games = games;
    const players = await cargo({ tables: "ScoreboardPlayers=SP",
      fields: ["GameId", "Link", "Team", "Role", "Side", "Kills", "Deaths", "Assists", "CS", "Gold", "DamageToChampions", "VisionScore"].map((field) => `SP.${field}=${field}`).join(","),
      where: `SP.MatchId IN (${ids})` });
    result.players = players;
    if (!games.length) return result;
    // Box scores lack GD10/15 and XPD10/15. Read their actual timeline snapshots as well.
    const metadata = await cargo({ tables: "PostgameJsonMetadata", fields: "GameId=GameId,TimelinePage=TimelinePage",
      where: `GameId IN (${games.map((game) => `"${escape(game.GameId!)}"`).join(",")})` });
    const pages = metadata.filter((row) => row.TimelinePage);
    for (let index = 0; index < pages.length; index += 5) {
      const batch = pages.slice(index, index + 5);
      const body = await request({ action: "query", titles: batch.map((row) => row.TimelinePage).join("|"), prop: "revisions", rvprop: "content", rvslots: "main" });
      for (const page of Object.values(body.query?.pages ?? {}) as Array<{ title: string; revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }>) {
        const gameId = batch.find((row) => row.TimelinePage?.replace(/_/g, " ") === page.title.replace(/_/g, " "))?.GameId;
        const content = page.revisions?.[0]?.slots?.main?.["*"];
        if (!content || !gameId) continue;
        const timeline = JSON.parse(content) as { frames?: TimelineFrame[] };
        addBriefingTimelineMetrics(players.filter((row) => row.GameId === gameId), timeline.frames ?? []);
      }
    }
  } catch (error) {
    // Keep verified results and box scores even when optional timeline data is unavailable.
    console.warn(`[match-briefing] ${teamPage} 상세 지표 보충 실패`, error);
  }
  return result;
}
