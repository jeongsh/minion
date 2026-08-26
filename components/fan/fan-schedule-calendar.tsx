"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { CalendarEvent, CalendarEventType } from "@/lib/calendar/events";
import { CALENDAR_EVENT_COLORS } from "@/lib/calendar/theme";

export type FanScheduleMatch = {
  id: string;
  dateKey: string;
  href: string;
  time: string;
  opponentName: string;
  opponentLogoUrl: string | null;
  opponentLogoDarkUrl?: string | null;
};

type CalendarItem =
  | { kind: "match"; match: FanScheduleMatch }
  | { kind: "event"; event: CalendarEvent };

type CalendarItemType = "match" | CalendarEventType;

const ITEM_META: Record<CalendarItemType, { color: string; emoji: string }> = {
  match: { color: "#00a66f", emoji: "🎮" },
  birthday: { color: CALENDAR_EVENT_COLORS.birthday, emoji: "🎂" },
  debut: { color: CALENDAR_EVENT_COLORS.debut, emoji: "🎉" },
  championship: { color: CALENDAR_EVENT_COLORS.championship, emoji: "🏆" },
  custom: { color: "#f97316", emoji: "📅" },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DESKTOP_ITEM_LIMIT = 3;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDay(date: Date) {
  return dateKey(date).slice(5);
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthFromKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function calendarWeeks(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(start);
      day.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      return day;
    }),
  );
}

function itemTime(item: CalendarItem) {
  if (item.kind === "match") return item.match.time;
  return item.event.eventTime ?? "99:99";
}

function itemTitle(item: CalendarItem) {
  if (item.kind === "match") return item.match.opponentName;
  return item.event.title;
}

function itemSort(a: CalendarItem, b: CalendarItem) {
  return itemTime(a).localeCompare(itemTime(b)) || itemTitle(a).localeCompare(itemTitle(b), "ko");
}

function OpponentLogo({ match, mini = false }: { match: FanScheduleMatch; mini?: boolean }) {
  const sizeClass = mini ? "h-4 w-4" : "h-6 w-6";

  return (
    <span className="shrink-0" aria-hidden="true">
      {match.opponentLogoUrl ? (
        <span className={`relative block overflow-hidden rounded-full border border-[var(--ui-border)] bg-white ${match.opponentLogoDarkUrl ? "dark:bg-transparent" : ""} ${sizeClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={match.opponentLogoUrl}
            alt=""
            className={`h-full w-full object-contain ${match.opponentLogoDarkUrl ? "dark:hidden" : ""}`}
          />
          {match.opponentLogoDarkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.opponentLogoDarkUrl} alt="" className="hidden h-full w-full object-contain dark:block" />
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function EventIcon({ event, large = false, mini = false }: { event: CalendarEvent; large?: boolean; mini?: boolean }) {
  const meta = ITEM_META[event.type];
  const sizeClass = large ? "h-8 w-8 text-[14px]" : mini ? "h-4 w-4 text-[13px]" : "h-6 w-6 text-[13px]";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${sizeClass}`}
      style={{ background: `${meta.color}1f` }}
      aria-hidden="true"
    >
      {event.playerImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.playerImageUrl} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        meta.emoji
      )}
    </span>
  );
}

function MobileCalendarPreview({ item, outside }: { item: CalendarItem; outside: boolean }) {
  return (
    <span className="flex min-w-0 w-full items-center gap-0.5">
      {item.kind === "match" ? (
        <OpponentLogo match={item.match} mini />
      ) : item.event.playerImageUrl ? (
        <EventIcon event={item.event} mini />
      ) : (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: ITEM_META[item.event.type].color }}
          aria-hidden="true"
        />
      )}
      <span className={`min-w-0 flex-1 truncate text-left text-[12px] font-normal leading-4 text-[var(--ui-muted)] ${outside ? "opacity-45" : ""}`}>
        {itemTitle(item)}
      </span>
    </span>
  );
}

function DesktopCalendarItem({ item, outside }: { item: CalendarItem; outside: boolean }) {
  const content = (
    <>
      {item.kind === "match" ? (
        <OpponentLogo match={item.match} />
      ) : (
        <EventIcon event={item.event} />
      )}
      <span className={`min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ui-ink)] ${outside ? "opacity-45" : ""}`}>
        {itemTitle(item)}
      </span>
      <span className={`shrink-0 text-[12px] font-normal tabular-nums text-[var(--ui-muted)] ${outside ? "opacity-45" : ""}`}>
        {itemTime(item) === "99:99" ? "" : itemTime(item)}
      </span>
    </>
  );
  const className = `flex min-h-8 w-full items-center gap-0.5 rounded-lg border border-transparent px-0.5 py-1 text-left transition-colors hover:border-[var(--ui-border)] hover:bg-[var(--ui-card-hover)] ${outside ? "bg-transparent" : "bg-[var(--ui-card-bg)]"}`;

  if (item.kind === "match") {
    return (
      <Link href={item.match.href} className={className} aria-label={`${itemTitle(item)}, ${item.match.time} 경기 상세`}>
        {content}
      </Link>
    );
  }

  if (item.event.sourceUrl) {
    return (
      <a
        href={item.event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={className}
        aria-label={`${item.event.title} 출처 열기`}
      >
        {content}
      </a>
    );
  }

  return <span className={className}>{content}</span>;
}

function MobileCalendarPopup({
  dateKeyValue,
  items,
  onClose,
}: {
  dateKeyValue: string;
  items: CalendarItem[];
  onClose: () => void;
}) {
  const selectedDate = dateFromKey(dateKeyValue);
  const title = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 p-4 lg:hidden"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 일정`}
        className="w-full max-w-[300px] rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2.5 text-left shadow-[0_20px_55px_rgba(0,0,0,0.18)]"
      >
        <div className="mb-2 flex items-center justify-between gap-2 px-1 py-0.5">
          <p className="text-[14px] font-medium text-[var(--ui-ink)]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="날짜 상세 닫기"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex max-h-[60svh] flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => {
            if (item.kind === "match") {
              return (
                <Link
                  key={`popup-match-${item.match.id}`}
                  href={item.match.href}
                  className="flex items-center gap-2.5 rounded-xl bg-[var(--ui-card-bg)] px-3 py-2.5 transition-colors hover:bg-[var(--ui-card-hover)]"
                >
                  <OpponentLogo match={item.match} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ui-ink)]">
                    {item.match.opponentName}
                  </span>
                  <span className="shrink-0 text-[13px] font-medium tabular-nums text-[var(--ui-muted)]">
                    {item.match.time}
                  </span>
                </Link>
              );
            }

            const meta = ITEM_META[item.event.type];
            const content = (
              <span className="flex items-center gap-2.5 rounded-xl bg-[var(--ui-card-bg)] px-3 py-2">
                <EventIcon event={item.event} large />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ui-ink)]">
                  {item.event.title}
                </span>
                <span className="shrink-0 text-[13px] font-medium" style={{ color: meta.color }}>
                  {item.event.eventTime ?? "종일"}
                </span>
              </span>
            );

            return item.event.sourceUrl ? (
              <a
                key={`popup-${item.event.key}`}
                href={item.event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {content}
              </a>
            ) : (
              <span key={`popup-${item.event.key}`}>{content}</span>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FanScheduleCalendar({
  initialMonthKey,
  matches,
  events,
  action,
}: {
  initialMonthKey: string;
  matches: FanScheduleMatch[];
  events: CalendarEvent[];
  action?: ReactNode;
}) {
  const todayDateKey = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromKey(initialMonthKey));
  const [selectedMobileDateKey, setSelectedMobileDateKey] = useState<string | null>(null);
  const weeks = useMemo(() => calendarWeeks(visibleMonth), [visibleMonth]);

  const matchesByDate = useMemo(() => {
    const map = new Map<string, FanScheduleMatch[]>();
    for (const match of matches) {
      const list = map.get(match.dateKey) ?? [];
      list.push(match);
      map.set(match.dateKey, list);
    }
    return map;
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

  function itemsForDate(value: string): CalendarItem[] {
    const day = dateFromKey(value);
    return [
      ...(matchesByDate.get(value) ?? []).map((match): CalendarItem => ({ kind: "match", match })),
      ...(recurringEventsByMonthDay.get(monthDay(day)) ?? []).map(
        (event): CalendarItem => ({ kind: "event", event }),
      ),
      ...(oneTimeEventsByDate.get(value) ?? []).map((event): CalendarItem => ({ kind: "event", event })),
    ].sort(itemSort);
  }

  function moveMonth(offset: number) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  function showToday() {
    const today = dateFromKey(todayDateKey);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const monthLabel = `${visibleMonth.getFullYear()}년 ${visibleMonth.getMonth() + 1}월`;
  const selectedMobileItems = selectedMobileDateKey ? itemsForDate(selectedMobileDateKey) : [];

  return (
    <div className="min-w-0">
      <div className="mb-1 flex h-9 items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달로 이동"
            className="grid h-9 w-9 place-items-center text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <strong className="min-w-[116px] text-center text-[15px] font-medium text-[var(--ui-ink)]">{monthLabel}</strong>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="다음 달로 이동"
            className="grid h-9 w-9 place-items-center text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={showToday}
            className="ml-1 h-9 px-2 text-[14px] font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
          >
            오늘
          </button>
        </div>
        {action}
      </div>

      <div role="grid" aria-label={`${monthLabel} 일정`} className="hidden border-b border-[var(--ui-border)] lg:block">
        <div className="grid grid-cols-7 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/45" role="row">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              role="columnheader"
              className={`py-1.5 text-center text-[13px] font-medium ${
                index === 0 ? "text-red-500/80" : index === 6 ? "text-blue-500/80" : "text-[var(--ui-muted)]"
              }`}
            >
              {weekday}
            </div>
          ))}
        </div>
        <div role="rowgroup">
          {weeks.map((week, weekIndex) => (
            <div
              key={`desktop-week-${weekIndex}`}
              role="row"
              className="grid grid-cols-7 border-b border-[var(--ui-border)] last:border-b-0"
            >
              {week.map((day) => {
                const key = dateKey(day);
                const items = itemsForDate(key);
                const outside = day.getMonth() !== visibleMonth.getMonth();
                const isToday = key === todayDateKey;
                const hiddenCount = Math.max(0, items.length - DESKTOP_ITEM_LIMIT);

                return (
                  <div
                    key={key}
                    role="gridcell"
                    style={{ height: "clamp(136px, calc((100svh - 180px) / 6), 164px)" }}
                    className={`min-w-0 overflow-hidden border-r border-[var(--ui-border)] p-2 last:border-r-0 ${
                      outside ? "bg-[var(--ui-surface-muted)]/30" : ""
                    }`}
                  >
                    <div>
                      <div className="mb-0.5 flex h-5 items-center justify-between">
                        <span
                          aria-current={isToday ? "date" : undefined}
                          className={`grid h-5 w-5 place-items-center text-[13px] font-medium tabular-nums ${outside ? "opacity-45" : ""} ${
                            isToday
                              ? "rounded-full bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                              : "text-[var(--ui-muted)]"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {hiddenCount > 0 ? (
                          <span className="text-[13px] font-normal text-[var(--ui-muted)]">+{hiddenCount}</span>
                        ) : null}
                      </div>
                      {items.slice(0, DESKTOP_ITEM_LIMIT).map((item) => (
                        <DesktopCalendarItem
                          key={item.kind === "match" ? `match-${item.match.id}` : item.event.key}
                          item={item}
                          outside={outside}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div role="grid" aria-label={`${monthLabel} 모바일 일정`} className="border-b border-[var(--ui-border)] lg:hidden">
        <div className="grid grid-cols-7 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/45" role="row">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              role="columnheader"
              className={`py-1 text-center text-[13px] font-medium ${
                index === 0 ? "text-red-500/80" : index === 6 ? "text-blue-500/80" : "text-[var(--ui-muted)]"
              }`}
            >
              {weekday}
            </div>
          ))}
        </div>
        <div role="rowgroup">
          {weeks.map((week, weekIndex) => (
            <div
              key={`mobile-week-${weekIndex}`}
              role="row"
              className="grid grid-cols-7 border-b border-[var(--ui-border)] last:border-b-0"
            >
              {week.map((day) => {
                const key = dateKey(day);
                const items = itemsForDate(key);
                const outside = day.getMonth() !== visibleMonth.getMonth();
                const isToday = key === todayDateKey;

                return (
                  <div
                    key={key}
                    role="gridcell"
                    className={`min-w-0 border-r border-[var(--ui-border)] last:border-r-0 ${
                      outside ? "bg-[var(--ui-surface-muted)]/30" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMobileDateKey(items.length > 0 ? key : null)}
                      aria-label={`${key}, 일정 ${items.length}건 보기`}
                      aria-pressed={selectedMobileDateKey === key}
                      className={`flex w-full flex-col items-center gap-0.5 py-1 transition-colors ${
                        selectedMobileDateKey === key ? "bg-[var(--ui-surface-muted)]" : ""
                      }`}
                      style={{ height: "80px" }}
                    >
                      <span
                        aria-current={isToday ? "date" : undefined}
                        className={`grid h-6 w-6 place-items-center text-[13px] font-medium tabular-nums ${outside ? "opacity-45" : ""} ${
                          isToday ? "rounded-full bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-ink)]"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <span className="flex w-full min-w-0 flex-col gap-0.5 px-0.5" aria-hidden="true">
                        {items.slice(0, 2).map((item) => (
                          <MobileCalendarPreview
                            key={item.kind === "match" ? `mobile-match-${item.match.id}` : `mobile-event-${item.event.key}`}
                            item={item}
                            outside={outside}
                          />
                        ))}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-1 lg:hidden" aria-label="일정 색상 안내">
        {(Object.entries(ITEM_META) as [CalendarItemType, (typeof ITEM_META)[CalendarItemType]][]).map(([type, meta]) => (
          <span key={type} className="flex items-center gap-1 text-[13px] font-normal text-[var(--ui-muted)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
            {{ match: "경기", birthday: "생일", debut: "데뷔", championship: "우승", custom: "기념일" }[type]}
          </span>
        ))}
      </div>

      {selectedMobileDateKey && selectedMobileItems.length > 0 ? (
        <MobileCalendarPopup
          dateKeyValue={selectedMobileDateKey}
          items={selectedMobileItems}
          onClose={() => setSelectedMobileDateKey(null)}
        />
      ) : null}
    </div>
  );
}
