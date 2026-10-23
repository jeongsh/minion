import "server-only";
import { unstable_cache } from "next/cache";
import type { Match, Player, Team } from "../types.ts";
import { briefingTeamsNeedingData, mergeLeaguepediaBriefingData, type BriefingData } from "../match-briefing-data.ts";
import { fetchLeaguepediaBriefingRows } from "../sync/leaguepedia-briefing.ts";

const getRows = unstable_cache(fetchLeaguepediaBriefingRows, ["leaguepedia-briefing-v1"], { revalidate: 3600 });
const inFlight = new Map<string, ReturnType<typeof getRows>>();
const retryAfter = new Map<string, number>();

export async function supplementMatchBriefingData(match: Match, teams: Team[], players: Player[], data: BriefingData): Promise<BriefingData> {
  let result = data;
  for (const id of briefingTeamsNeedingData(match, data)) {
    const team = teams.find((item) => item.id === id);
    const page = team?.leaguepediaPage ?? team?.sourceTeamId?.replace(/^lp:/, "");
    if (!page) continue;
    const key = `${page}:${match.matchDate}`;
    if ((retryAfter.get(key) ?? 0) > Date.now()) continue;
    try {
      let promise = inFlight.get(key);
      if (!promise) {
        promise = getRows(page, match.matchDate);
        inFlight.set(key, promise);
      }
      const rows = await promise;
      result = mergeLeaguepediaBriefingData(match, result, rows, teams, players);
    } catch (error) {
      retryAfter.set(key, Date.now() + 5 * 60_000);
      console.warn(`[match-briefing] ${page} 최근 경기 보충 실패`, error);
    } finally {
      inFlight.delete(key);
    }
  }
  return result;
}
