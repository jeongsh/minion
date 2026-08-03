import { KITSCH_PALETTES } from "@/lib/theme/palettes";
import type { CalendarEventType } from "@/lib/calendar/events";

// 축하(생일) UI 공통 팔레트.
// 축하 배너와 두 달력(홈/덕질)의 '생일'이 같은 색을 쓰도록 한 곳에서 관리한다.
// 데뷔·우승·기념일·경기 색은 각 달력이 기존 값을 그대로 유지한다.

/** 축하 브랜드 블루. 배너 배경과 달력의 생일 점에 쓴다. */
export const CELEBRATION_COLOR = KITSCH_PALETTES.celebration.main;

/** 블루 위에 올리는 밝은 강조색(배너 윗줄 라벨). 대비 4.94:1. */
export const CELEBRATION_ACCENT = KITSCH_PALETTES.celebration.point;

/** 블루 위 보조 면(배너 아바타 배경). */
export const CELEBRATION_SURFACE_SOFT = KITSCH_PALETTES.celebration.soft;

/** 캘린더 점·축하 배너·날짜 상세 카드가 함께 쓰는 이벤트 색상. */
export const CALENDAR_EVENT_COLORS: Record<CalendarEventType, string> = {
  birthday: CELEBRATION_COLOR,
  debut: "#7c5cff",
  championship: "#f5c518",
  custom: "#f5c518",
};

export const CALENDAR_EVENT_BANNER_THEME: Record<
  CalendarEventType,
  { background: string; accent: string; soft: string; foreground: string }
> = {
  birthday: {
    background: CELEBRATION_COLOR,
    accent: CELEBRATION_ACCENT,
    soft: CELEBRATION_SURFACE_SOFT,
    foreground: "#ffffff",
  },
  debut: {
    background: CALENDAR_EVENT_COLORS.debut,
    accent: "#e4ddff",
    soft: "#927dff",
    foreground: "#ffffff",
  },
  championship: {
    background: CALENDAR_EVENT_COLORS.championship,
    accent: "#5a4600",
    soft: "#ffe46b",
    foreground: "#211a00",
  },
  custom: {
    background: CALENDAR_EVENT_COLORS.custom,
    accent: "#5a4600",
    soft: "#ffe46b",
    foreground: "#211a00",
  },
};
