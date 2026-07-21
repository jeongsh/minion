import type { SeasonSegmentKey } from "@/lib/tournaments/season-2026";

export type InternationalSegmentTheme = {
  key: SeasonSegmentKey;
  name: string;
  description: string;
  accent: string;
  // 대회 스위처/헤더에 쓰는 로고. public/logos/tournaments/ 에 파일을 넣고 여기에 경로를
  // 지정하면 자동으로 노출된다. 단색 svg를 mask + currentColor로 그리므로 로고 파일의
  // fill 색과 무관하게 텍스트 색(활성/비활성/다크모드)을 따라간다. 마스크는 알파 채널을
  // 쓰기 때문에 배경이 투명한 파일이어야 한다(webp도 알파만 있으면 동작).
  logo?: string;
  // 로고 원본 비율(가로/세로). 마크는 높이 기준으로 그려지고 폭을 이 값으로 정한다.
  logoAspect?: number;
};

// LCK/LCK Cup은 국내 정규 리그이므로 대회 허브에서는 국제 대회만 소개한다.
export const INTERNATIONAL_SEGMENTS: InternationalSegmentTheme[] = [
  {
    key: "first-stand",
    name: "First Stand",
    description: "시즌을 여는 국제 대회",
    accent: "#8b6df0",
    logo: "/logos/tournaments/first-stand.svg",
    logoAspect: 1000 / 922,
  },
  {
    key: "msi",
    name: "MSI",
    description: "Mid-Season Invitational",
    accent: "#ff4757",
    logo: "/logos/tournaments/msi.svg",
    logoAspect: 63.13 / 64,
  },
  {
    key: "ewc",
    name: "EWC",
    description: "Esports World Cup",
    accent: "#2dd4bf",
    logo: "/logos/tournaments/ewc.svg",
    logoAspect: 133 / 26,
  },
  {
    key: "worlds",
    name: "월드 챔피언십",
    description: "리그 오브 레전드 월드 챔피언십",
    accent: "#eab308",
    logo: "/logos/tournaments/worlds.svg",
    logoAspect: 1,
  },
  {
    key: "enc",
    name: "ENC",
    description: "Esports Nations Cup",
    accent: "#34d399",
    logo: "/logos/tournaments/enc.webp",
    logoAspect: 399 / 90,
  },
];

export function internationalSegmentByKey(key: string) {
  return INTERNATIONAL_SEGMENTS.find((segment) => segment.key === key) ?? null;
}

// LCK는 국내 대회라 대진표(브래킷) 위주인 국제 대회들과 성격이 달라 별도로 둔다.
// 대회 허브/상세 페이지에서는 segmentThemeByKey로 국제 대회와 함께 노출한다.
// LCK컵은 LCK의 "스플릿 1"이라 별도 카드 없이 LCK 상세 페이지 안에 합쳐서 보여준다
// (matchesTournamentSegment 참고).
export const DOMESTIC_SEGMENTS: InternationalSegmentTheme[] = [
  {
    key: "lck",
    name: "LCK",
    description: "리그 오브 레전드 챔피언스 코리아 정규 시즌",
    accent: "#2f7dfa",
    logo: "/logos/tournaments/lck.svg",
    logoAspect: 205.05 / 145.52,
  },
  {
    key: "kespa-cup",
    name: "KeSPA Cup",
    description: "한국e스포츠협회 주관 컵 대회",
    accent: "#f97316",
    logo: "/logos/tournaments/kespa-cup.svg",
    logoAspect: 200 / 219,
  },
];

export function domesticSegmentByKey(key: string) {
  return DOMESTIC_SEGMENTS.find((segment) => segment.key === key) ?? null;
}

export function segmentThemeByKey(key: string): InternationalSegmentTheme | null {
  return internationalSegmentByKey(key) ?? domesticSegmentByKey(key);
}
