import "server-only";
import { unstable_cache } from "next/cache";

import { parsePowerRankings, type MatchPowerRankings } from "@/lib/power-rankings";

// 원본 HTML은 2MB를 넘으므로 파싱한 작은 이력만 Next 데이터 캐시에 보관한다.
const getPowerRankingTeams = unstable_cache(async (year: number) => {
  const response = await fetch(`https://lolesports.com/en-US/gpr/${year}/current`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`공식 파워랭킹 응답 ${response.status}`);
  return parsePowerRankings(await response.text());
}, ["official-power-ranking-history-v1"], { revalidate: 3600 });

export async function getPowerRankings(year: number): Promise<MatchPowerRankings> {
  const sourceUrl = `https://lolesports.com/en-US/gpr/${year}/current`;
  try {
    return { status: "ready", sourceUrl, teams: await getPowerRankingTeams(year) };
  } catch (error) {
    console.warn("[power-rankings] 조회 실패", error);
    return { status: "error", sourceUrl, teams: [] };
  }
}
