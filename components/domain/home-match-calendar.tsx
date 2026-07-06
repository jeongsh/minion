"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";

export type HomeCalendarMatch = {
  id: string;
  dateKey: string;
  href: string;
  time: string;
  title: string;
  teams: string;
};

function localDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeyFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function HomeMatchCalendar({
  initialMonthKey,
  matches,
}: {
  initialMonthKey: string;
  matches: HomeCalendarMatch[];
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

  const matchDates = useMemo(() => [...matchesByDate.keys()].map(localDateFromKey), [matchesByDate]);
  const initialMonth = localDateFromKey(`${initialMonthKey}-01`);
  const [selected, setSelected] = useState<Date | undefined>();
  const [popupPosition, setPopupPosition] = useState<{ left: number; top: number } | null>(null);
  const selectedKey = selected ? dateKeyFromLocalDate(selected) : "";
  const selectedMatches = selectedKey ? matchesByDate.get(selectedKey) ?? [] : [];

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
    <section ref={containerRef} className="relative h-[330px] overflow-visible rounded-2xl border border-[var(--ui-border)] bg-white p-5 dark:bg-[var(--ui-surface-muted)]">
      <DayPicker
        mode="single"
        selected={selected}
        onDayClick={(day, _modifiers, event) => {
          const key = dateKeyFromLocalDate(day);
          const dayMatches = matchesByDate.get(key) ?? [];

          if (dayMatches.length === 0) {
            setSelected(undefined);
            setPopupPosition(null);
            return;
          }

          const containerRect = containerRef.current?.getBoundingClientRect();
          const dayRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          if (containerRect) {
            const popupWidth = 248;
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
        components={{
          Chevron: ({ orientation, className }) => {
            const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : orientation === "up" ? ChevronUp : ChevronDown;
            return <Icon className={className} size={14} strokeWidth={2.25} />;
          },
        }}
        modifiers={{ hasMatch: matchDates }}
        modifiersClassNames={{ hasMatch: "home-calendar-has-match" }}
        className="home-match-calendar"
      />
      {popupPosition && selectedMatches.length > 0 ? (
        <div
          className="absolute z-30 w-[248px] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.16)]"
          style={{ left: popupPosition.left, top: popupPosition.top }}
        >
          <p className="mb-2 text-xs font-black text-[var(--ui-ink)]">{selected?.getDate()}일 경기</p>
          <div className="flex flex-col gap-2">
            {selectedMatches.map((match) => (
              <Link
                key={match.id}
                href={match.href}
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 transition hover:border-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)]"
              >
                <span className="block text-[12px] font-bold text-[var(--ui-muted)]">{match.time}</span>
                <span className="mt-1 block text-xs font-black leading-snug text-[var(--ui-ink)]">{match.title}</span>
                <span className="mt-1 block text-[12px] font-semibold text-[var(--ui-muted)]">{match.teams}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
