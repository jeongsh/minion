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
