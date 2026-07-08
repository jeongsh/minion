"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { ko } from "react-day-picker/locale";

import type { CalendarEvent, CalendarEventType } from "@/lib/calendar/events";

const TYPE_META: Record<CalendarEventType, { emoji: string; color: string; label: string }> = {
  birthday: { emoji: "🎂", color: "#ff3f7f", label: "생일" },
  debut: { emoji: "🎉", color: "#7c5cff", label: "데뷔" },
  championship: { emoji: "🏆", color: "#f5a623", label: "우승" },
  custom: { emoji: "🎈", color: "#12b886", label: "기념일" },
};

function monthDayOf(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ddayLabel(dday: number) {
  return dday === 0 ? "D-DAY" : `D-${dday}`;
}

function EventAvatar({ event, size = "h-11 w-11" }: { event: CalendarEvent; size?: string }) {
  const meta = TYPE_META[event.type];
  const src = event.playerImageUrl ?? (event.type !== "birthday" ? event.teamLogoUrl : null);
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full text-lg`}
      style={{ background: `${meta.color}1f` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        meta.emoji
      )}
    </span>
  );
}

export function CelebrationCalendar({
  events,
  initialMonthKey,
}: {
  events: CalendarEvent[];
  /** "YYYY-MM" — 초기 표시 월 */
  initialMonthKey: string;
}) {
  // MM-DD -> 해당 날짜의 이벤트들(연도 무관, 매년 반복).
  const eventsByMonthDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.monthDay) ?? [];
      list.push(e);
      map.set(e.monthDay, list);
    }
    return map;
  }, [events]);

  const [initYear, initMonth] = initialMonthKey.split("-").map(Number);
  const [selectedMonthDay, setSelectedMonthDay] = useState<string | null>(null);
  const selectedEvents = selectedMonthDay ? eventsByMonthDay.get(selectedMonthDay) ?? [] : [];

  const upcoming = events.slice(0, 8);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
      {/* D-day 레일 */}
      <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2">
        {upcoming.length === 0 ? (
          <p className="grid min-h-[280px] place-items-center px-4 text-center text-sm text-[var(--ui-muted)]">
            등록된 기념일이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col">
            {upcoming.map((event) => {
              const meta = TYPE_META[event.type];
              const isToday = event.dday === 0;
              const content = (
                <div
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--ui-surface-muted)]"
                  style={isToday ? { background: `${meta.color}14` } : undefined}
                >
                  <EventAvatar event={event} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--ui-ink)]">
                      {meta.emoji} {event.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-[var(--ui-muted)]">
                      {event.nextDateKey.slice(5).replace("-", "월 ")}일
                      {event.teamShort ? ` · ${event.teamShort}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black text-white"
                    style={{ background: meta.color }}
                  >
                    {ddayLabel(event.dday)}
                  </span>
                </div>
              );
              return (
                <li key={event.key} className="border-b border-[var(--ui-border)] last:border-0">
                  {event.playerSlug ? (
                    <Link href={`/players/${event.playerSlug}`}>{content}</Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 월 달력 */}
      <div className="celebration-calendar relative rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
        <DayPicker
          defaultMonth={new Date(initYear, (initMonth || 1) - 1, 1)}
          locale={ko}
          showOutsideDays
          fixedWeeks
          onDayClick={(day) => {
            const md = monthDayOf(day);
            const has = (eventsByMonthDay.get(md) ?? []).length > 0;
            setSelectedMonthDay(has && selectedMonthDay !== md ? md : null);
          }}
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
              const { day, modifiers: _modifiers, ...buttonProps } = props;
              const md = monthDayOf(day.date);
              const dayEvents = eventsByMonthDay.get(md) ?? [];
              const types = Array.from(new Set(dayEvents.map((e) => e.type)));
              return (
                <button {...buttonProps}>
                  <span>{day.date.getDate()}</span>
                  {types.length > 0 ? (
                    <span className="celebration-dots">
                      {types.slice(0, 3).map((t) => (
                        <span key={t} className="celebration-dot" style={{ background: TYPE_META[t].color }} />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            },
          }}
          className="home-match-calendar"
        />

        {selectedMonthDay && selectedEvents.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--ui-border)] pt-3">
            {selectedEvents.map((event) => {
              const meta = TYPE_META[event.type];
              return (
                <div key={event.key} className="flex items-center gap-2.5 rounded-xl bg-[var(--ui-surface-muted)] px-3 py-2">
                  <EventAvatar event={event} size="h-8 w-8" />
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-[var(--ui-ink)]">
                    {meta.emoji} {event.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-black" style={{ color: meta.color }}>
                    {ddayLabel(event.dday)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--ui-border)] pt-3">
            {(Object.keys(TYPE_META) as CalendarEventType[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ui-muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_META[t].color }} />
                {TYPE_META[t].label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
