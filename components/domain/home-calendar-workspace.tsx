"use client";

import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import type { CalendarEvent } from "@/lib/calendar/events";

type Props = {
  initialMonthKey: string;
  matches: HomeCalendarMatch[];
  events: CalendarEvent[];
  compactOnDesktop?: boolean;
};

/** 홈에서는 월간 달력과 선택 날짜 상세를 하나의 카드 안에서 전환해 보여준다. */
export function HomeCalendarWorkspace({
  initialMonthKey,
  matches,
  events,
  compactOnDesktop = false,
}: Props) {
  return (
    <div
      className={`w-full max-w-[360px] ${
        compactOnDesktop ? "home-calendar-compact xl:max-w-none" : ""
      }`}
    >
      <HomeCalendar
        initialMonthKey={initialMonthKey}
        matches={matches}
        events={events}
        heightClassName={
          compactOnDesktop
            ? "h-[400px] sm:h-[410px] xl:h-[282px]"
            : "h-[400px] sm:h-[410px]"
        }
        detailMode="popover"
      />
    </div>
  );
}
