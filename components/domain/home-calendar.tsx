"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import "react-day-picker/style.css";

import type { CalendarEvent, CalendarEventType } from "@/lib/calendar/events";

export type HomeCalendarMatch = {
  id: string;
  dateKey: string;
  href: string;
  time: string;
  league: string;
  teamAName: string;
  teamBName: string;
  teamALogoUrl: string | null;
  teamBLogoUrl: string | null;
  teamALogoDarkUrl?: string | null;
  teamBLogoDarkUrl?: string | null;
};

type DotType = "match" | CalendarEventType;

// 우승(championship)은 별도 색을 지정하지 않고 기념일과 같은 취급으로 묶는다.
const DOT_META: Record<DotType, { color: string; label: string; emoji: string }> = {
  match: { color: "#00b979", label: "경기", emoji: "🎮" },
  birthday: { color: "#ef4444", label: "생일", emoji: "🎂" },
  debut: { color: "#7c5cff", label: "데뷔", emoji: "🎉" },
  championship: { color: "#f5c518", label: "기념일", emoji: "🏆" },
  custom: { color: "#f5c518", label: "기념일", emoji: "🎈" },
};

const LEGEND: DotType[] = ["match", "birthday", "debut", "custom"];

function localDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeyFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDayFromLocalDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ddayLabel(dday: number) {
  return dday === 0 ? "D-DAY" : `D-${dday}`;
}

/** 홈 메인 캘린더 — 경기 일정과 선수 생일/데뷔/기념일을 한 달력에 색 점으로 함께 보여준다. */
export function HomeCalendar({
  initialMonthKey,
  matches,
  events,
}: {
  initialMonthKey: string;
  matches: HomeCalendarMatch[];
  events: CalendarEvent[];
}) {
  const containerRef = useRef<HTMLElement>(null);

  const matchesByDate = useMemo(() => {
    const groups = new Map<string, HomeCalendarMatch[]>();
    for (const match of matches) {
      const list = groups.get(match.dateKey) ?? [];
      list.push(match);
      groups.set(match.dateKey, list);
    }
    return groups;
  }, [matches]);

  // 생일/데뷔/기념일은 MM-DD 기준 매년 반복이라 연도 무관하게 매칭한다.
  const eventsByMonthDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.monthDay) ?? [];
      list.push(event);
      map.set(event.monthDay, list);
    }
    return map;
  }, [events]);

  const initialMonth = localDateFromKey(`${initialMonthKey}-01`);
  const [selected, setSelected] = useState<Date | undefined>();
  const [popupPosition, setPopupPosition] = useState<{ left: number; top: number } | null>(null);

  const selectedKey = selected ? dateKeyFromLocalDate(selected) : "";
  const selectedMonthDay = selected ? monthDayFromLocalDate(selected) : "";
  const selectedMatches = selectedKey ? (matchesByDate.get(selectedKey) ?? []) : [];
  const selectedEvents = selectedMonthDay ? (eventsByMonthDay.get(selectedMonthDay) ?? []) : [];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      setSelected(undefined);
      setPopupPosition(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex h-[360px] min-w-0 flex-col overflow-visible rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3"
    >
      {/* globals.css의 커스텀 CSS는 빌드 시 var(--ui-ink) 같은 CSS 변수가 라이트 모드 값으로
          굳어버리는 문제가 있어(다크모드에서 안 먹음), 월/연도 캡션 색만은 빌드 파이프라인을
          거치지 않는 인라인 style 태그로 직접 덮어써서 다크모드에서도 제대로 보이게 한다. */}
      <style>{`.home-match-calendar .rdp-month_caption { color: var(--ui-ink) !important; }`}</style>
      <DayPicker
        mode="single"
        selected={selected}
        onDayClick={(day, _modifiers, event) => {
          const key = dateKeyFromLocalDate(day);
          const monthDay = monthDayFromLocalDate(day);
          const hasAnything =
            (matchesByDate.get(key)?.length ?? 0) > 0 || (eventsByMonthDay.get(monthDay)?.length ?? 0) > 0;

          if (!hasAnything || (selected && dateKeyFromLocalDate(selected) === key)) {
            setSelected(undefined);
            setPopupPosition(null);
            return;
          }

          const containerRect = containerRef.current?.getBoundingClientRect();
          const dayRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          if (containerRect) {
            const popupWidth = 260;
            const left = Math.min(
              Math.max(dayRect.left - containerRect.left - popupWidth / 2 + dayRect.width / 2, 8),
              Math.max(containerRect.width - popupWidth - 8, 8),
            );
            const top = dayRect.bottom - containerRect.top + 10;
            setPopupPosition({ left, top });
          }

          setSelected(day);
        }}
        defaultMonth={initialMonth}
        locale={ko}
        showOutsideDays
        fixedWeeks
        style={
          {
            "--rdp-day-height": "38px",
            "--rdp-day_button-height": "32px",
            "--rdp-day_button-width": "32px",
          } as CSSProperties
        }
        components={{
          Chevron: ({ orientation, className }) => {
            const Icon =
              orientation === "left"
                ? ChevronLeft
                : orientation === "right"
                  ? ChevronRight
                  : orientation === "up"
                    ? ChevronUp
                    : ChevronDown;
            return <Icon className={className} size={14} strokeWidth={2.25} />;
          },
          DayButton: (props: DayButtonProps) => {
            const { day, modifiers, className, ...buttonProps } = props;
            const key = dateKeyFromLocalDate(day.date);
            const monthDay = monthDayFromLocalDate(day.date);
            const dayTypes = new Set<DotType>();
            if ((matchesByDate.get(key)?.length ?? 0) > 0) dayTypes.add("match");
            for (const event of eventsByMonthDay.get(monthDay) ?? []) dayTypes.add(event.type);
            const types = Array.from(dayTypes);
            // 오늘 날짜는 --rdp-accent-color(라이트 모드 색으로 고정됨)에 기대지 않고
            // 테마에 반응하는 ui-ink를 직접 강제 지정해 다크모드에서도 숫자가 보이게 한다.
            return (
              <button
                {...buttonProps}
                className={`${className ?? ""} flex! flex-col items-center justify-center gap-0.5 leading-none ${
                  modifiers.today && !modifiers.selected
                    ? "text-[var(--ui-ink)]! ring-1! ring-inset! ring-[var(--ui-ink)]/35!"
                    : ""
                }`}
              >
                <span>{day.date.getDate()}</span>
                <span className="flex h-1 items-center justify-center gap-0.5">
                  {types.slice(0, 3).map((t) => (
                    <span key={t} className="h-1 w-1 rounded-full" style={{ background: DOT_META[t].color }} />
                  ))}
                </span>
              </button>
            );
          },
        }}
        className="home-match-calendar"
      />

      {popupPosition && (selectedMatches.length > 0 || selectedEvents.length > 0) ? (
        <div
          className="absolute z-30 w-[260px] rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2.5 text-left shadow-[0_20px_55px_rgba(0,0,0,0.18)]"
          style={{ left: popupPosition.left, top: popupPosition.top }}
        >
          {selected ? (
            <p className="mb-2 px-1 py-0.5 text-sm font-black text-[var(--ui-ink)]">
              {selected.getMonth() + 1}월 {selected.getDate()}일
            </p>
          ) : null}
          <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
            {selectedMatches.map((match) => (
              <Link
                key={match.id}
                href={match.href}
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-[var(--ui-surface-muted)] px-3 py-2.5 transition hover:border-[var(--ui-border)]"
              >
                <span className="flex shrink-0 flex-col gap-0.5">
                  {match.league ? (
                    <span className="text-[13px] font-medium text-[var(--ui-muted)]">{match.league}</span>
                  ) : null}
                  <span
                    className="flex items-center gap-1 text-[13px] font-medium"
                    style={{ color: DOT_META.match.color }}
                  >
                    <Clock3 className="size-3" strokeWidth={2.25} />
                    {match.time}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  {match.teamALogoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={match.teamALogoUrl} alt="" className={`h-4 w-4 shrink-0 object-contain ${match.teamALogoDarkUrl ? "dark:hidden" : ""}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {match.teamALogoDarkUrl ? <img src={match.teamALogoDarkUrl} alt="" className="hidden h-4 w-4 shrink-0 object-contain dark:block" /> : null}
                    </>
                  ) : null}
                  <span className="truncate text-sm font-black leading-snug text-[var(--ui-ink)]">
                    {match.teamAName}
                  </span>
                  <span className="shrink-0 text-[13px] font-medium text-[var(--ui-muted)]">vs</span>
                  {match.teamBLogoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={match.teamBLogoUrl} alt="" className={`h-4 w-4 shrink-0 object-contain ${match.teamBLogoDarkUrl ? "dark:hidden" : ""}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {match.teamBLogoDarkUrl ? <img src={match.teamBLogoDarkUrl} alt="" className="hidden h-4 w-4 shrink-0 object-contain dark:block" /> : null}
                    </>
                  ) : null}
                  <span className="truncate text-sm font-black leading-snug text-[var(--ui-ink)]">
                    {match.teamBName}
                  </span>
                </span>
              </Link>
            ))}
            {selectedEvents.map((event) => {
              const meta = DOT_META[event.type];
              const content = (
                <div className="flex items-center gap-2.5 rounded-xl bg-[var(--ui-surface-muted)] px-3 py-2">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-sm"
                    style={{ background: `${meta.color}1f` }}
                  >
                    {event.playerImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.playerImageUrl} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      meta.emoji
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-black text-[var(--ui-ink)]">
                    {event.title}
                  </span>
                  <span className="shrink-0 text-[13px] font-medium" style={{ color: meta.color }}>
                    {ddayLabel(event.dday)}
                  </span>
                </div>
              );
              return (
                <div key={event.key}>
                  {event.playerSlug ? <Link href={`/players/${event.playerSlug}`}>{content}</Link> : content}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--ui-border)] pt-2.5">
        {LEGEND.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ui-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: DOT_META[t].color }} />
            {DOT_META[t].label}
          </span>
        ))}
      </div>
    </section>
  );
}
