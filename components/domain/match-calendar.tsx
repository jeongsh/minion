"use client";

import { useState } from "react";

export type CalendarMatch = {
  id: string;
  dateKey: string; // "YYYY-MM-DD" KST
  teamALogo?: string;
  teamAShort: string;
  teamBLogo?: string;
  teamBShort: string;
  href: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function MatchCalendar({ matches }: { matches: CalendarMatch[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const matchByDate = new Map<string, CalendarMatch[]>();
  for (const m of matches) {
    const list = matchByDate.get(m.dateKey) ?? [];
    list.push(m);
    matchByDate.set(m.dateKey, list);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-hidden rounded-xl border border-[#e8eaf0] bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[#e8eaf0] px-5 py-4">
        <button
          onClick={prevMonth}
          type="button"
          aria-label="이전 달"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-[#667085] transition-colors hover:bg-[#f4f5f8] hover:text-[#111827]"
        >
          ‹
        </button>
        <span className="text-base font-black text-[#111827]">
          {year}년 {month + 1}월
        </span>
        <button
          onClick={nextMonth}
          type="button"
          aria-label="다음 달"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-[#667085] transition-colors hover:bg-[#f4f5f8] hover:text-[#111827]"
        >
          ›
        </button>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 border-b border-[#f0f2f5]">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-2.5 text-center text-[11px] font-black ${
              i === 0 ? "text-red-400" : i === 6 ? "text-[#5c88da]" : "text-[#98a2b3]"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 divide-x divide-y divide-[#f0f2f5]">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[80px] bg-[#fafafa]" />;
          }

          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayMatches = matchByDate.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;
          const dow = (firstDow + day - 1) % 7;
          const isSun = dow === 0;
          const isSat = dow === 6;
          const hasMatch = dayMatches.length > 0;

          return (
            <div
              key={dateKey}
              className={`flex min-h-[80px] flex-col gap-1 p-1.5 ${hasMatch ? "bg-white" : "bg-white"}`}
            >
              {/* 날짜 */}
              <span
                className={`inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-[12px] font-black ${
                  isToday
                    ? "bg-accent text-white"
                    : isSun
                      ? "text-red-400"
                      : isSat
                        ? "text-[#5c88da]"
                        : "text-[#344054]"
                }`}
              >
                {day}
              </span>

              {/* 경기 */}
              <div className="flex flex-col gap-0.5">
                {dayMatches.slice(0, 2).map((m) => (
                  <a
                    key={m.id}
                    href={m.href}
                    className="group flex items-center justify-center gap-1 rounded-md bg-[#f4f5f8] px-1 py-1 transition-colors hover:bg-accent/10"
                    title={`${m.teamAShort} vs ${m.teamBShort}`}
                  >
                    {m.teamALogo ? (
                      <img src={m.teamALogo} alt={m.teamAShort} className="h-4 w-4 object-contain" />
                    ) : (
                      <span className="text-[9px] font-black text-[#667085]">{m.teamAShort.slice(0, 2)}</span>
                    )}
                    <span className="text-[9px] font-black text-[#98a2b3] group-hover:text-accent">vs</span>
                    {m.teamBLogo ? (
                      <img src={m.teamBLogo} alt={m.teamBShort} className="h-4 w-4 object-contain" />
                    ) : (
                      <span className="text-[9px] font-black text-[#667085]">{m.teamBShort.slice(0, 2)}</span>
                    )}
                  </a>
                ))}
                {dayMatches.length > 2 && (
                  <span className="text-center text-[9px] font-semibold text-[#98a2b3]">
                    +{dayMatches.length - 2}경기
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
