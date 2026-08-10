import { unstable_cache } from "next/cache";
import {
  getAllTeams,
  getMatches,
  getPlayerStatLines,
  getPlayers,
  getSets,
  getTournaments,
} from "@/lib/data/lck";
import { PLAYER_PUBLIC_DATA_TAG } from "@/lib/data/player-cache";
import type { PlayerStatLine } from "@/lib/types";

/**
 * 기록실 페이지가 쓰는 리그 전체(로그인 무관) 공개 데이터.
 * 매 요청 풀스캔하지 않고 선수 페이지와 같은 태그로 5분 캐시한다.
 */
export const getRecordsBaseData = unstable_cache(
  async () => {
    const [tournaments, teams, players, matches, sets] = await Promise.all([
      getTournaments(),
      getAllTeams(),
      getPlayers(),
      getMatches(),
      getSets(),
    ]);
    return { tournaments, teams, players, matches, sets };
  },
  ["records-base-data"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG] },
);

/**
 * 선택된 시즌/대회에 속한 세트들의 선수 스탯 라인. set_player_stats 는 세트당
 * 10행이라 시즌 전체를 조회하면 페이지네이션 청크가 여러 번 도는 비싼 쿼리다 —
 * 필터(시즌/대회) 조합별로 캐시해 재방문·다른 유저의 동일 필터 요청을 공유한다.
 */
export const getRecordsStatLines = unstable_cache(
  async (setIds: string[]): Promise<PlayerStatLine[]> => {
    if (setIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let index = 0; index < setIds.length; index += 90) {
      chunks.push(setIds.slice(index, index + 90));
    }
    const results = await Promise.all(chunks.map((ids) => getPlayerStatLines(ids)));
    return results.flat();
  },
  ["records-stat-lines"],
  { revalidate: 300, tags: [PLAYER_PUBLIC_DATA_TAG] },
);
