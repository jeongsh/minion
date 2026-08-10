import { unstable_cache } from "next/cache";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatings,
  getLeagueAverageStatsBase,
  getMatches,
  getPlayerStatLines,
  getSetPicksBans,
  getSets,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import { createPlayerRadarBenchmark, type PlayerRadarBenchmark } from "@/lib/stats";
import type { Player } from "@/lib/types";

/**
 * 선수 상세 화면이 쓰는 리그 전체(로그인 무관) 공개 데이터 캐시 태그.
 * 선수/경기/세트/픽밴/팬평점을 바꾸는 관리자·동기화 액션은 이 태그를 updateTag 해서
 * 캐시를 즉시 무효화할 수 있다(안 해도 revalidate 창이 지나면 갱신된다).
 */
export const PLAYER_PUBLIC_DATA_TAG = "player-public-data";

const POSITIONS: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

/**
 * 선수 상세는 모든 선수(147명)가 팀/선수/경기/세트/대회/챔피언/순위/팬평점이라는
 * 동일한 리그 전체 데이터를 공유한다. 요청마다 매번 풀스캔하지 않고 캐시해서 공유한다.
 */
export const getPlayerPageSharedData = unstable_cache(
  async () => {
    const [teams, players, matches, sets, fanRatings, tournaments, champions, standings] =
      await Promise.all([
        getAllTeams(),
        getAllPlayers(),
        getMatches(),
        getSets(),
        getFanRatings(),
        getTournaments(),
        getChampions(),
        getTeamStandings(),
      ]);

    return { teams, players, matches, sets, fanRatings, tournaments, champions, standings };
  },
  ["player-page-shared-data"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG] },
);

/**
 * 리그 전체 평균 지표(팀 레이더 차트 비교용). set_player_stats/sets 풀스캔이라
 * 팀 페이지마다 매번 다시 돌리면 비싸다 — 선수 페이지와 같은 태그로 5분 캐시한다.
 */
export const getLeagueAverageStats = unstable_cache(
  getLeagueAverageStatsBase,
  ["league-average-stats"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG] },
);

export type PlayerPageSegmentData = {
  /** 동 포지션 레이더 벤치마크(포지션별). */
  radarBenchmarkByPosition: Partial<Record<Player["position"], PlayerRadarBenchmark>>;
  /** 챔피언별 구간 내 픽/밴 횟수. */
  pickBanByChampion: Record<string, { pickCount: number; banCount: number }>;
  /** 챔피언별 사용 선수 id(첫 등장 순서, 중복 제거). 이름 매핑/상위 3명 자르기는 페이지에서 한다. */
  mainUserIdsByChampion: Record<string, string[]>;
};

/**
 * 활성 시즌 구간 세트들의 "리그 전체" 집계.
 * set_picks_bans 는 2만 행이 넘어 구간 전체를 조회하면 페이지네이션으로 수십 번의 순차
 * 요청이 발생한다 — 선수 페이지에서 단연 가장 비싼 쿼리다. 게다가 원본 행을 그대로
 * 반환하면 5MB가 넘어 unstable_cache(2MB 한도)에 저장되지 못한다.
 * 그래서 화면에 실제로 쓰이는 값(포지션 벤치마크·챔피언 픽밴 수·사용 선수)만 미리 집계해
 * 작게 캐시한다. 이 결과는 선수와 무관하게 구간(세트 집합)에만 의존하므로 전 선수가 공유한다.
 */
export const getPlayerPageSegmentData = unstable_cache(
  async (segmentSetIds: string[]): Promise<PlayerPageSegmentData> => {
    if (segmentSetIds.length === 0) {
      return { radarBenchmarkByPosition: {}, pickBanByChampion: {}, mainUserIdsByChampion: {} };
    }

    const [scopedLines, scopedPicksBans] = await Promise.all([
      getPlayerStatLines(segmentSetIds),
      getSetPicksBans(segmentSetIds),
    ]);

    const radarBenchmarkByPosition: Partial<Record<Player["position"], PlayerRadarBenchmark>> = {};
    for (const position of POSITIONS) {
      const benchmark = createPlayerRadarBenchmark(
        scopedLines.filter((line) => line.position === position),
      );
      if (benchmark) {
        radarBenchmarkByPosition[position] = benchmark;
      }
    }

    const pickBanByChampion: Record<string, { pickCount: number; banCount: number }> = {};
    for (const item of scopedPicksBans) {
      if (!item.championId) continue;
      const entry = (pickBanByChampion[item.championId] ??= { pickCount: 0, banCount: 0 });
      if (item.actionType === "pick") entry.pickCount += 1;
      else if (item.actionType === "ban") entry.banCount += 1;
    }

    // scopedLines 는 (position, set_id) 순으로 정렬돼 있어 첫 등장 순서를 그대로 보존한다.
    const mainUserIdsByChampion: Record<string, string[]> = {};
    const seenByChampion = new Map<string, Set<string>>();
    for (const line of scopedLines) {
      if (!line.championId) continue;
      let seen = seenByChampion.get(line.championId);
      if (!seen) {
        seen = new Set<string>();
        seenByChampion.set(line.championId, seen);
      }
      if (seen.has(line.playerId)) continue;
      seen.add(line.playerId);
      (mainUserIdsByChampion[line.championId] ??= []).push(line.playerId);
    }

    return { radarBenchmarkByPosition, pickBanByChampion, mainUserIdsByChampion };
  },
  ["player-page-segment-data"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG] },
);
