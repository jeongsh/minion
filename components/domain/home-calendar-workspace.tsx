"use client";

import Link from "next/link";
import { ChevronRight, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { celebrationBoardHref, type CalendarEvent, type CalendarEventType } from "@/lib/calendar/events";
import { CALENDAR_EVENT_COLORS } from "@/lib/calendar/theme";

const EVENT_META: Record<CalendarEventType, { label: string; color: string }> = {
  birthday: { label: "생일", color: CALENDAR_EVENT_COLORS.birthday },
  debut: { label: "데뷔", color: CALENDAR_EVENT_COLORS.debut },
  championship: { label: "우승 기념일", color: CALENDAR_EVENT_COLORS.championship },
  custom: { label: "기념일", color: CALENDAR_EVENT_COLORS.custom },
};

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function dateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return { year, month, day, weekday };
}

type Props = {
  initialMonthKey: string;
  initialDateKey: string;
  matches: HomeCalendarMatch[];
  events: CalendarEvent[];
};

/** 메인 전용 조합. 공용 캘린더의 팝업 대신 선택 날짜의 내용을 독립된 두 번째 칼럼에 보여준다. */
export function HomeCalendarWorkspace({ initialMonthKey, initialDateKey, matches, events }: Props) {
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const selectedMatches = useMemo(
    () => matches.filter((match) => match.dateKey === selectedDateKey),
    [matches, selectedDateKey],
  );
  const selectedEvents = useMemo(() => {
    const monthDay = selectedDateKey.slice(5);
    return events.filter((event) =>
      event.isRecurring ? event.monthDay === monthDay : event.nextDateKey === selectedDateKey,
    );
  }, [events, selectedDateKey]);
  const date = dateParts(selectedDateKey);
  const isEmpty = selectedMatches.length === 0 && selectedEvents.length === 0;

  return (
    <>
      <HomeCalendar
        initialMonthKey={initialMonthKey}
        matches={matches}
        events={events}
        heightClassName="h-[300px]"
        detailMode="external"
        onSelectedDateKeyChange={(dateKey) => setSelectedDateKey(dateKey ?? initialDateKey)}
      />

      <section className="flex h-[300px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
        <header className="flex h-[33px] items-center gap-3">
          <h3 className="truncate text-base font-bold text-[var(--ui-ink)]">
            {date.month}월 {date.day}일 · {date.weekday}
          </h3>
          <span className="ml-auto shrink-0 text-[12px] text-[var(--ui-muted)]">
            일정 {selectedMatches.length + selectedEvents.length}개
          </span>
        </header>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="grid h-full place-items-center px-4 text-center">
              <div>
                <p className="text-sm text-[var(--ui-muted)]">등록된 경기나 이벤트가 없습니다.</p>
                <p className="mt-1 text-[12px] text-[var(--ui-muted)]">캘린더에서 다른 날짜를 선택해보세요.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={match.href}
                  className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-white px-3 py-2 text-[var(--ui-ink)] transition hover:bg-[var(--ui-surface-muted)] dark:bg-[var(--ui-surface-muted)] dark:hover:brightness-110"
                >
                  <span className="truncate text-[12px] text-[var(--ui-muted)]">
                    {match.league || "LCK"}
                  </span>
                  <span className="flex min-w-0 items-center justify-center gap-2 text-sm font-bold">
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      {match.teamALogoUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={match.teamALogoUrl} alt="" className={`size-5 shrink-0 object-contain ${match.teamALogoDarkUrl ? "dark:hidden" : ""}`} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {match.teamALogoDarkUrl ? <img src={match.teamALogoDarkUrl} alt="" className="hidden size-5 shrink-0 object-contain dark:block" /> : null}
                        </>
                      ) : null}
                      <span className="truncate">{match.teamAName}</span>
                    </span>
                    <span className="shrink-0 font-normal text-[var(--ui-muted)]">vs</span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate">{match.teamBName}</span>
                      {match.teamBLogoUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={match.teamBLogoUrl} alt="" className={`size-5 shrink-0 object-contain ${match.teamBLogoDarkUrl ? "dark:hidden" : ""}`} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {match.teamBLogoDarkUrl ? <img src={match.teamBLogoDarkUrl} alt="" className="hidden size-5 shrink-0 object-contain dark:block" /> : null}
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-[13px] text-[var(--ui-muted)]">
                    <Clock3 className="size-3" strokeWidth={2} />
                    {match.time}
                  </span>
                </Link>
              ))}

              {selectedEvents.map((event) => {
                const meta = EVENT_META[event.type];
                const content = (
                  <div className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-white px-3 py-2 text-[var(--ui-ink)] transition hover:bg-[var(--ui-surface-muted)] dark:bg-[var(--ui-surface-muted)] dark:hover:brightness-110">
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)] dark:bg-[var(--ui-surface)]">
                      {event.playerImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={event.playerImageUrl} alt="" className="h-full w-full object-cover object-top" />
                      ) : (
                        <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-[var(--ui-muted)]">{meta.label}</span>
                      <span className="block truncate text-sm font-bold">{event.title}</span>
                    </span>
                    {event.teamShort ? (
                      <span className="shrink-0 text-[12px] text-[var(--ui-muted)]">{event.teamShort}</span>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 text-[var(--ui-muted)]" strokeWidth={1.8} />
                  </div>
                );

                return (
                  <Link key={event.key} href={celebrationBoardHref(event)} className="block">
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
