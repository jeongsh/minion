"use client";

import Link from "next/link";
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
    <section ref={containerRef} className="relative rounded-2xl border border-[#e8ecf5] bg-white p-7">
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
        modifiers={{ hasMatch: matchDates }}
        modifiersClassNames={{ hasMatch: "home-calendar-has-match" }}
        className="home-match-calendar"
      />
      {popupPosition && selectedMatches.length > 0 ? (
        <div
          className="absolute z-30 w-[248px] rounded-xl border border-[#dfe3ee] bg-white p-3 text-left shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
          style={{ left: popupPosition.left, top: popupPosition.top }}
        >
          <p className="mb-2 text-xs font-black text-[#111827]">{selected?.getDate()}일 경기</p>
          <div className="flex flex-col gap-2">
            {selectedMatches.map((match) => (
              <Link
                key={match.id}
                href={match.href}
                className="rounded-lg border border-[#edf0f6] bg-white px-3 py-2 transition hover:border-[#6a66ff] hover:bg-[#f7f6ff]"
              >
                <span className="block text-[11px] font-bold text-[#64708f]">{match.time}</span>
                <span className="mt-1 block text-xs font-black leading-snug text-[#111827]">{match.title}</span>
                <span className="mt-1 block text-[11px] font-semibold text-[#7c86a0]">{match.teams}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
