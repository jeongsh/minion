import { unstable_cache } from "next/cache";
import {
  getAllTeams,
  getHomeHeroSlides,
  getLatestTeamVideos,
  getMatches,
  getTournaments,
} from "@/lib/data/lck";
import { getCalendarEvents } from "@/lib/calendar/events";

/**
 * 홈 화면 상단(팀/경기/순위/대회/영상/슬라이드/달력) 캐시 태그.
 * 이 데이터를 바꾸는 관리자 액션(리그피디아 동기화, 영상, 홈 슬라이더, 달력)은
 * revalidatePath("/") 와 함께 updateTag(HOME_PUBLIC_DATA_TAG) 도 호출해야
 * 캐시가 즉시 무효화된다.
 */
export const HOME_PUBLIC_DATA_TAG = "home-public-data";

/** 웹과 모바일 홈이 함께 쓰는 DB 중심 데이터. */
export const getMobileHomePublicData = unstable_cache(
  async () => {
    const [teams, matches, tournaments, calendarEvents] = await Promise.all([
      getAllTeams(),
      getMatches(),
      getTournaments(),
      getCalendarEvents(),
    ]);

    return { teams, matches, tournaments, calendarEvents };
  },
  ["home-core-public-data"],
  { revalidate: 30, tags: [HOME_PUBLIC_DATA_TAG] },
);

/**
 * 홈 화면 상단은 로그인 여부와 무관한 전 유저 공통 데이터라 요청마다 새로 읽지 않고
 * 30초간 캐시한다(팀/경기/대회 자체는 자주 편집되지 않고, 편집되는 것들은 각 관리자
 * 액션에서 태그로 즉시 무효화한다).
 */
export const getHomePagePublicData = unstable_cache(
  async () => {
    const [{ teams, matches, tournaments, calendarEvents }, latestVideos, homeHeroSlides] =
      await Promise.all([
        getMobileHomePublicData(),
        getLatestTeamVideos(12),
        getHomeHeroSlides({ limit: 8 }),
      ]);

    return { teams, matches, tournaments, latestVideos, homeHeroSlides, calendarEvents };
  },
  ["home-page-public-data"],
  { revalidate: 30, tags: [HOME_PUBLIC_DATA_TAG] },
);
