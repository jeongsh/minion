export type NewsTone = "league" | "red" | "gold" | "blue" | "orange" | "mint";

export type NewsArticle = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
  category: "LCK" | "경기" | "팀" | "선수" | "이적";
  teamSlugs: string[];
  tone: NewsTone;
  thumbnailUrl?: string;
  isOfficial?: boolean;
  homeRank?: number;
};

/** NAVER API HUB를 사용할 수 없을 때만 노출하는 화면 유지용 데이터다. */
export const newsArticles: NewsArticle[] = [
  {
    id: "lck-weekly-race",
    title: "플레이오프를 향한 순위 경쟁, 이번 주 LCK 관전 포인트",
    source: "LCK",
    url: "https://lolesports.com/ko-KR/news",
    publishedAt: "2026-08-03T20:30:00+09:00",
    summary: "상위권 맞대결부터 중위권의 치열한 승수 경쟁까지, 이번 주 주요 대진을 한눈에 살펴봅니다.",
    category: "LCK",
    teamSlugs: [],
    tone: "league",
    isOfficial: true,
    homeRank: 1,
  },
  {
    id: "geng-team-form",
    title: "흔들림 없는 운영, GEN이 만드는 후반부 승리 공식",
    source: "네이버 e스포츠",
    url: "https://game.naver.com/esports/League_of_Legends/home",
    publishedAt: "2026-08-03T18:10:00+09:00",
    summary: "오브젝트 설계와 교전 집중력을 중심으로 최근 경기 흐름을 짚었습니다.",
    category: "팀",
    teamSlugs: ["geng"],
    tone: "gold",
    homeRank: 2,
  },
  {
    id: "t1-next-match",
    title: "다음 상대를 준비하는 T1, 핵심은 초반 주도권",
    source: "인벤 e스포츠",
    url: "https://www.inven.co.kr/webzine/news/?iskin=esports",
    publishedAt: "2026-08-03T15:40:00+09:00",
    summary: "라인전 이후 첫 오브젝트까지 이어지는 T1의 선택을 데이터와 함께 정리했습니다.",
    category: "팀",
    teamSlugs: ["t1"],
    tone: "red",
    homeRank: 3,
  },
  {
    id: "kt-hle-preview",
    title: "KT와 HLE의 정면 승부, 미드 라인에서 갈릴 흐름",
    source: "데일리e스포츠",
    url: "https://www.dailyesports.com/",
    publishedAt: "2026-08-03T13:20:00+09:00",
    summary: "상위권 판도를 흔들 수 있는 맞대결의 밴픽 포인트와 최근 전적을 살펴봅니다.",
    category: "경기",
    teamSlugs: ["kt", "hle"],
    tone: "orange",
    homeRank: 4,
  },
  {
    id: "rookie-watch",
    title: "후반기 판도를 바꾸는 신예들, 주목할 선수 다섯 명",
    source: "네이버 e스포츠",
    url: "https://game.naver.com/esports/League_of_Legends/home",
    publishedAt: "2026-08-02T21:00:00+09:00",
    summary: "출전 기회를 잡은 신예 선수들의 역할과 팀에 가져온 변화를 모았습니다.",
    category: "선수",
    teamSlugs: ["drx", "bro", "fox"],
    tone: "mint",
    homeRank: 5,
  },
  {
    id: "dk-draft-change",
    title: "밴픽 폭을 넓힌 DK, 달라진 첫 세트 접근법",
    source: "인벤 e스포츠",
    url: "https://www.inven.co.kr/webzine/news/?iskin=esports",
    publishedAt: "2026-08-02T17:30:00+09:00",
    summary: "최근 시리즈에서 확인된 챔피언 우선순위 변화와 교전 설계를 분석합니다.",
    category: "팀",
    teamSlugs: ["dk"],
    tone: "blue",
    homeRank: 6,
  },
  {
    id: "ns-mid-season",
    title: "NS의 반등을 만든 한타 집중력, 숫자로 본 변화",
    source: "데일리e스포츠",
    url: "https://www.dailyesports.com/",
    publishedAt: "2026-08-02T14:15:00+09:00",
    summary: "킬 관여율과 주요 오브젝트 교전 지표로 최근 상승세의 배경을 확인합니다.",
    category: "팀",
    teamSlugs: ["ns"],
    tone: "red",
  },
  {
    id: "fox-fast-tempo",
    title: "속도를 끌어올린 FOX, 20분 전 선택이 달라졌다",
    source: "네이버 e스포츠",
    url: "https://game.naver.com/esports/League_of_Legends/home",
    publishedAt: "2026-08-01T19:50:00+09:00",
    summary: "전령과 드래곤 사이에서 과감해진 운영이 경기 결과에 미친 영향을 살펴봅니다.",
    category: "팀",
    teamSlugs: ["fox"],
    tone: "orange",
  },
  {
    id: "bro-long-game",
    title: "장기전에서 답을 찾은 BRO, 수비에서 역전까지",
    source: "인벤 e스포츠",
    url: "https://www.inven.co.kr/webzine/news/?iskin=esports",
    publishedAt: "2026-08-01T15:25:00+09:00",
    summary: "불리한 구도를 버티고 후반 한타로 연결한 BRO의 운영을 되짚습니다.",
    category: "경기",
    teamSlugs: ["bro"],
    tone: "gold",
  },
  {
    id: "soop-objective",
    title: "DNS의 오브젝트 설계, 시야 장악이 만든 결정적 차이",
    source: "데일리e스포츠",
    url: "https://www.dailyesports.com/",
    publishedAt: "2026-07-31T20:40:00+09:00",
    summary: "바론 앞 시야 싸움과 사이드 라인 관리가 승부에 미친 영향을 정리했습니다.",
    category: "팀",
    teamSlugs: ["soop"],
    tone: "blue",
  },
  {
    id: "drx-young-roster",
    title: "과감해진 DRX의 젊은 로스터, 다음 단계는 안정감",
    source: "네이버 e스포츠",
    url: "https://game.naver.com/esports/League_of_Legends/home",
    publishedAt: "2026-07-31T16:05:00+09:00",
    summary: "공격적인 시도와 함께 보완해야 할 중반 운영 과제를 살펴봅니다.",
    category: "선수",
    teamSlugs: ["drx"],
    tone: "mint",
  },
  {
    id: "lck-rulebook",
    title: "2026 LCK 후반기, 알아두면 좋은 대회 진행 방식",
    source: "LCK",
    url: "https://lolesports.com/ko-KR/news",
    publishedAt: "2026-07-30T11:00:00+09:00",
    summary: "그룹 배틀부터 플레이인과 플레이오프까지 남은 시즌의 진행 방식을 정리했습니다.",
    category: "LCK",
    teamSlugs: [],
    tone: "league",
    isOfficial: true,
  },
];

export function formatNewsDate(value: string, includeYear = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
