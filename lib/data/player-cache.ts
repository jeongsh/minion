import { unstable_cache } from "next/cache";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getLeagueAverageStatsBase,
  getMatchesForScope,
  getPlayerStatSetIds,
  getSetsByIds,
  getPlayerFanPogSetIdsBase,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import { createSupabaseServerClient, canQuerySupabase } from "@/lib/supabase/server";
import { createPlayerRadarBenchmarkFromAggregates, type PlayerRadarBenchmark } from "@/lib/stats";
import type { Player, PlayerStatLine } from "@/lib/types";
import { PLAYER_FAN_POG_CACHE_TAG } from "@/lib/fan-rating";

/**
 * 선수 상세 화면이 쓰는 리그 전체(로그인 무관) 공개 데이터 캐시 태그.
 * 선수/경기/세트/픽밴/팬평점을 바꾸는 관리자·동기화 액션은 이 태그를 updateTag 해서
 * 캐시를 즉시 무효화할 수 있다(안 해도 revalidate 창이 지나면 갱신된다).
 */
export const PLAYER_PUBLIC_DATA_TAG = "player-public-data";


/** 집계 결과만 캐시하며 평점 변경 시 공용 태그로 무효화한다. */
export const getPlayerFanPogSetIds = unstable_cache(
  getPlayerFanPogSetIdsBase,
  ["player-fan-pog-set-ids"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG, PLAYER_FAN_POG_CACHE_TAG] },
);

/** 선수의 출전 경기와 POM 경기만 공유 참조 정보에 포함한다. */
export const getPlayerPageSharedData = unstable_cache(
  async (playerId: string) => {
    const [teams, players, playedSetIds, tournaments, champions, standings] =
      await Promise.all([
        getAllTeams(),
        getAllPlayers(),
        getPlayerStatSetIds(playerId),
        getTournaments(),
        getChampions(),
        getTeamStandings(),
      ]);

    const sets = await getSetsByIds(playedSetIds);
    const [playedMatches, pomMatches] = await Promise.all([
      getMatchesForScope({ ids: [...new Set(sets.map(set => set.matchId))] }),
      getMatchesForScope({ pomPlayerId: playerId }),
    ]);
    const matches = [...new Map([...playedMatches, ...pomMatches].map(match => [match.id, match])).values()];
    return { teams, players, matches, sets, tournaments, champions, standings };
  },
  ["player-page-scoped-data-v2"],
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

/** 같은 포지션의 선수별 합계와 챔피언별 집계만 DB에서 읽어 공용 캐시에 저장한다. */
export const getPlayerPageSegmentData = unstable_cache(
  async (segmentSetIds: string[], position: Player["position"]): Promise<PlayerPageSegmentData> => {
    if (!segmentSetIds.length || !canQuerySupabase()) return { radarBenchmarkByPosition: {}, pickBanByChampion: {}, mainUserIdsByChampion: {} };
    const { data, error } = await createSupabaseServerClient().rpc("read_player_segment_context", { p_set_ids: segmentSetIds, p_position: position });
    if (error) throw error;
    const result = data as Pick<PlayerPageSegmentData, "pickBanByChampion" | "mainUserIdsByChampion"> & { benchmarks: PlayerStatLine[] };
    const benchmark = createPlayerRadarBenchmarkFromAggregates(result.benchmarks);
    return { radarBenchmarkByPosition: benchmark ? { [position]: benchmark } : {}, pickBanByChampion: result.pickBanByChampion, mainUserIdsByChampion: result.mainUserIdsByChampion };
  },
  ["player-page-segment-aggregates-v2"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG] },
);
