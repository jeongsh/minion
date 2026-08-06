"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import "react-day-picker/style.css";

import type { CalendarEvent, CalendarEventType } from "@/lib/calendar/events";
import { CALENDAR_EVENT_COLORS } from "@/lib/calendar/theme";

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
  birthday: { color: CALENDAR_EVENT_COLORS.birthday, label: "생일", emoji: "🎂" },
  debut: { color: CALENDAR_EVENT_COLORS.debut, label: "데뷔", emoji: "🎉" },
  championship: { color: CALENDAR_EVENT_COLORS.championship, label: "기념일", emoji: "🏆" },
  custom: { color: CALENDAR_EVENT_COLORS.custom, label: "기념일", emoji: "🎈" },
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
  heightClassName = "h-[300px]",
  detailMode = "popover",
  onSelectedDateKeyChange,
}: {
  initialMonthKey: string;
  matches: HomeCalendarMatch[];
  events: CalendarEvent[];
  /**
   * 높이는 임의로 정하는 값이 아니라 내용물이 강제하는 최소치의 결과다.
   * p-3 상하 24 + 캡션 33 + 요일줄 24 + (fixedWeeks 6줄 × --rdp-day-height 30) + 범례 31 = 292px.
   * 즉 이 값만 줄이면 셀은 그대로인 채 그릇만 작아져서, overflow-visible 탓에
   * mt-auto 범례가 테두리 밖으로 삐져나온다. 더 줄이려면 --rdp-day-height부터 낮출 것.
   */
  heightClassName?: string;
  /** 메인에서는 날짜 상세를 별도 카드에 표시하고, 다른 사용처는 기존 팝업을 유지한다. */
  detailMode?: "popover" | "external";
  onSelectedDateKeyChange?: (dateKey: string | null) => void;
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

  const recurringEventsByMonthDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!event.isRecurring) continue;
      const list = map.get(event.monthDay) ?? [];
      list.push(event);
      map.set(event.monthDay, list);
    }
    return map;
  }, [events]);

  const oneTimeEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (event.isRecurring) continue;
      const list = map.get(event.nextDateKey) ?? [];
      list.push(event);
      map.set(event.nextDateKey, list);
    }
    return map;
  }, [events]);

  const initialMonth = localDateFromKey(`${initialMonthKey}-01`);
  const [selected, setSelected] = useState<Date | undefined>();

  const selectedKey = selected ? dateKeyFromLocalDate(selected) : "";
  const selectedMonthDay = selected ? monthDayFromLocalDate(selected) : "";
  const selectedMatches = selectedKey ? (matchesByDate.get(selectedKey) ?? []) : [];
  const selectedEvents =
    selectedKey && selectedMonthDay
      ? [
          ...(recurringEventsByMonthDay.get(selectedMonthDay) ?? []),
          ...(oneTimeEventsByDate.get(selectedKey) ?? []),
        ]
      : [];

  function closeDetail() {
    setSelected(undefined);
    onSelectedDateKeyChange?.(null);
  }

  // 팝업으로 따로 띄우지 않고 달력과 같은 칸을 재사용해서 상세를 보여준다.
  // 그래야 모달 밖으로 튀어나오거나 모달 자체가 늘어나 스크롤이 생기는 일 없이
  // 항상 캘린더 영역 안에서만 움직인다.
  const showDetail =
    detailMode === "popover" && Boolean(selected) && (selectedMatches.length > 0 || selectedEvents.length > 0);

  useEffect(() => {
    if (detailMode === "external") return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      setSelected(undefined);
      onSelectedDateKeyChange?.(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [detailMode, onSelectedDateKeyChange]);

  return (
    <section
      ref={containerRef}
      className={`relative flex ${heightClassName} min-w-0 flex-col ${showDetail ? "overflow-hidden" : "overflow-visible"} rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3`}
    >
      {/* globals.css의 커스텀 CSS는 빌드 시 var(--ui-ink) 같은 CSS 변수가 라이트 모드 값으로
          굳어버리는 문제가 있어(다크모드에서 안 먹음), 월/연도 캡션 색만은 빌드 파이프라인을
          거치지 않는 인라인 style 태그로 직접 덮어써서 다크모드에서도 제대로 보이게 한다. */}
      <style>{`.home-match-calendar .rdp-month_caption { color: var(--ui-ink) !important; }`}</style>
      {/* 상세를 보여줄 때도 DayPicker를 unmount하지 않고 숨기기만 한다(display:none).
          그래야 접었다 펼 때 이동해둔 월이 초기 월로 리셋되지 않는다. */}
      <div className={showDetail ? "hidden" : "contents"}>
        <DayPicker
          mode="single"
        selected={selected}
        onDayClick={(day) => {
          const key = dateKeyFromLocalDate(day);
          const monthDay = monthDayFromLocalDate(day);
          const hasAnything =
            (matchesByDate.get(key)?.length ?? 0) > 0 ||
            (recurringEventsByMonthDay.get(monthDay)?.length ?? 0) > 0 ||
            (oneTimeEventsByDate.get(key)?.length ?? 0) > 0;

          if (detailMode === "external") {
            setSelected(day);
            onSelectedDateKeyChange?.(key);
            return;
          }

          if (!hasAnything || (selected && dateKeyFromLocalDate(selected) === key)) {
            closeDetail();
            return;
          }

          setSelected(day);
          onSelectedDateKeyChange?.(key);
        }}
        defaultMonth={initialMonth}
        locale={ko}
        showOutsideDays
        fixedWeeks
        style={
          {
            "--rdp-day-height": "30px",
            "--rdp-day_button-height": "28px",
            "--rdp-day_button-width": "28px",
          } as CSSProperties
        }
        components={{
          Chevron: ({ orientation }) => {
            const Icon =
              orientation === "left"
                ? ChevronLeft
                : orientation === "right"
                  ? ChevronRight
                  : orientation === "up"
                    ? ChevronUp
                    : ChevronDown;
            return <Icon size={14} strokeWidth={2.25} />;
          },
          DayButton: (props: DayButtonProps) => {
            const { day, modifiers, className, ...buttonProps } = props;
            const key = dateKeyFromLocalDate(day.date);
            const monthDay = monthDayFromLocalDate(day.date);
            const dayTypes = new Set<DotType>();
            if ((matchesByDate.get(key)?.length ?? 0) > 0) dayTypes.add("match");
            for (const event of recurringEventsByMonthDay.get(monthDay) ?? []) dayTypes.add(event.type);
            for (const event of oneTimeEventsByDate.get(key) ?? []) dayTypes.add(event.type);
            const types = Array.from(dayTypes);
            // 오늘 날짜는 --rdp-accent-color(라이트 모드 색으로 고정됨)에 기대지 않고
            // 테마에 반응하는 ui-ink를 직접 강제 지정해 다크모드에서도 숫자가 보이게 한다.
            return (
              <button
                {...buttonProps}
                className={`${className ?? ""} flex! flex-col items-center justify-center gap-0.5 leading-none ${
                  modifiers.today && !modifiers.selected
                    ? "text-[var(--ui-ink)]! bg-[var(--ui-ink)]/12! border-transparent!"
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
      </div>

      {showDetail && selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1 py-0.5">
            <button
              type="button"
              onClick={closeDetail}
              className="flex items-center gap-1 text-sm font-black text-[var(--ui-ink)]"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
              {selected.getMonth() + 1}월 {selected.getDate()}일
            </button>
            <button
              type="button"
              onClick={closeDetail}
              aria-label="날짜 상세 닫기"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
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
