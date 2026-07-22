import { KITSCH_PALETTES } from "@/lib/theme/palettes";

// 축하(생일) UI 공통 팔레트.
// 축하 배너와 두 달력(홈/덕질)의 '생일'이 같은 색을 쓰도록 한 곳에서 관리한다.
// 데뷔·우승·기념일·경기 색은 각 달력이 기존 값을 그대로 유지한다.

/** 축하 브랜드 블루. 배너 배경과 달력의 생일 점에 쓴다. */
export const CELEBRATION_COLOR = KITSCH_PALETTES.celebration.main;

/** 블루 위에 올리는 밝은 강조색(배너 윗줄 라벨). 대비 4.94:1. */
export const CELEBRATION_ACCENT = KITSCH_PALETTES.celebration.point;

/** 블루 위 보조 면(배너 아바타 배경). */
export const CELEBRATION_SURFACE_SOFT = KITSCH_PALETTES.celebration.soft;
