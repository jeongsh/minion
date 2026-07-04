import type { SeasonSegmentKey } from "@/lib/tournaments/season-2026";

export type InternationalSegmentTheme = {
  key: SeasonSegmentKey;
  name: string;
  description: string;
  gradient: string;
  accent: string;
};

// LCK/LCK Cup은 국내 정규 리그이므로 대회 허브에서는 국제 대회만 소개한다.
export const INTERNATIONAL_SEGMENTS: InternationalSegmentTheme[] = [
  {
    key: "first-stand",
    name: "First Stand",
    description: "시즌을 여는 국제 대회",
    gradient: "from-[#1d1140] via-[#2a1a5e] to-[#4c2a8f]",
    accent: "#8b6df0",
  },
  {
    key: "msi",
    name: "MSI",
    description: "Mid-Season Invitational",
    gradient: "from-[#3a0d0d] via-[#7a1414] to-[#c62828]",
    accent: "#ff4757",
  },
  {
    key: "ewc",
    name: "EWC",
    description: "Esports World Cup",
    gradient: "from-[#0d2b2b] via-[#0f4c4c] to-[#14877e]",
    accent: "#2dd4bf",
  },
  {
    key: "worlds",
    name: "월드 챔피언십",
    description: "리그 오브 레전드 월드 챔피언십",
    gradient: "from-[#1a1a2e] via-[#2c2c54] to-[#c9a227]",
    accent: "#eab308",
  },
  {
    key: "enc",
    name: "ENC",
    description: "Esports Nations Cup",
    gradient: "from-[#0d2b1a] via-[#136437] to-[#2e9e5b]",
    accent: "#34d399",
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
    gradient: "from-[#0a1a3a] via-[#0e3a8f] to-[#2f7dfa]",
    accent: "#2f7dfa",
  },
];

export function domesticSegmentByKey(key: string) {
  return DOMESTIC_SEGMENTS.find((segment) => segment.key === key) ?? null;
}

export function segmentThemeByKey(key: string): InternationalSegmentTheme | null {
  return internationalSegmentByKey(key) ?? domesticSegmentByKey(key);
}
