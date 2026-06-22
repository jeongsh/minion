"use client";

import { useState } from "react";
import Link from "next/link";

export type ScheduleMatch = {
  id: string;
  dateKey: string;
  datetime: string;
  teamAId: string;
  teamALogo?: string;
  teamAShort: string;
  teamBId: string;
  teamBLogo?: string;
  teamBShort: string;
  bestOf?: number | null;
  status: string;
  href: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDow(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ── 캘린더 ────────────────────────────────────────────────────

function MiniCalendar({
  matches,
  selectedDate,
  onSelect,
}: {
  matches: ScheduleMatch[];
  selectedDate: string | null;
  onSelect: (dateKey: string | null) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDow(year, month);

  // 이 달 날짜별 경기 그루핑
  const matchByDate = new Map<string, ScheduleMatch[]>();
  for (const m of matches) {
    const [y, mo] = m.dateKey.split("-").map(Number);
    if (y !== year || mo !== month + 1) continue;
    const list = matchByDate.get(m.dateKey) ?? [];
    list.push(m);
    matchByDate.set(m.dateKey, list);
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e8eaf0] bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[#e8eaf0] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <span className="text-[15px] font-black text-[#111827]">캘린더</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/schedule" className="text-xs font-semibold text-[#98a2b3] hover:text-accent">
            전체 보기 →
          </Link>
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-sm font-black text-[#111827]">{year}년 {month + 1}월</span>
        <div className="flex gap-1">
          <button onClick={prevMonth} type="button" aria-label="이전 달"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#667085] hover:bg-[#f4f5f8] hover:text-[#111827]">
            ‹
          </button>
          <button onClick={nextMonth} type="button" aria-label="다음 달"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#667085] hover:bg-[#f4f5f8] hover:text-[#111827]">
            ›
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-y border-[#f0f2f5] bg-[#f8f9fc]">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`py-2 text-center text-[11px] font-black ${
            i === 0 ? "text-red-400" : i === 6 ? "text-[#5c88da]" : "text-[#98a2b3]"
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 divide-x divide-y divide-[#f0f2f5]">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="min-h-[88px] bg-[#fafafa]" />;
          }

          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayMatches = matchByDate.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;
          const isSelected = selectedDate === dateKey;
          const dow = (firstDow + day - 1) % 7;
          const isSun = dow === 0;
          const isSat = dow === 6;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(isSelected ? null : dateKey)}
              className={`flex min-h-[88px] w-full flex-col gap-1 p-1.5 text-left transition-colors ${
                isSelected ? "bg-accent/5" : "hover:bg-[#f8f9fc]"
              }`}
            >
              {/* 날짜 숫자 */}
              <span className={`flex h-6 w-6 items-center justify-center self-start rounded-full text-[12px] font-black ${
                isToday
                  ? "bg-accent text-white"
                  : isSelected
                    ? "text-accent"
                    : isSun
                      ? "text-red-400"
                      : isSat
                        ? "text-[#5c88da]"
                        : "text-[#344054]"
              }`}>
                {day}
              </span>

              {/* 경기: 팀A 로고 vs 팀B 로고 */}
              <div className="flex flex-col gap-0.5 w-full">
                {dayMatches.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-center gap-0.5 rounded px-0.5 py-0.5 ${
                      isSelected ? "bg-accent/10" : "bg-[#f4f5f8]"
                    }`}
                  >
                    {m.teamALogo ? (
                      <img src={m.teamALogo} alt={m.teamAShort} className="h-4 w-4 object-contain" />
                    ) : (
                      <span className="text-[8px] font-black text-[#667085]">{m.teamAShort.slice(0, 2)}</span>
                    )}
                    <span className="text-[8px] font-black text-[#98a2b3]">vs</span>
                    {m.teamBLogo ? (
                      <img src={m.teamBLogo} alt={m.teamBShort} className="h-4 w-4 object-contain" />
                    ) : (
                      <span className="text-[8px] font-black text-[#667085]">{m.teamBShort.slice(0, 2)}</span>
                    )}
                  </div>
                ))}
                {dayMatches.length > 3 && (
                  <span className="text-center text-[8px] font-semibold text-[#98a2b3]">
                    +{dayMatches.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 경기 카드 ─────────────────────────────────────────────────

function MatchCard({ match }: { match: ScheduleMatch }) {
  const isLive = match.status === "live";

  return (
    <Link
      href={match.href}
      className="group flex flex-col gap-3 rounded-xl border border-[#e8eaf0] bg-white p-4 transition-all hover:border-[#c7cbda] hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#98a2b3]">{match.datetime}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
          isLive ? "bg-red-50 text-red-500" : "bg-[#f0f2f5] text-[#667085]"
        }`}>
          {isLive ? "● LIVE" : match.bestOf ? `BO${match.bestOf}` : "예정"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-1.5">
          {match.teamALogo ? (
            <img src={match.teamALogo} alt={match.teamAShort} className="h-10 w-10 object-contain transition-transform group-hover:scale-105" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[#e8eaf0] text-xs font-black text-[#667085]">
              {match.teamAShort.slice(0, 3)}
            </span>
          )}
          <span className="text-[13px] font-black text-[#111827]">{match.teamAShort}</span>
        </div>

        <span className="text-xs font-semibold text-[#d0d5dd]">vs</span>

        <div className="flex flex-col items-center gap-1.5">
          {match.teamBLogo ? (
            <img src={match.teamBLogo} alt={match.teamBShort} className="h-10 w-10 object-contain transition-transform group-hover:scale-105" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[#e8eaf0] text-xs font-black text-[#667085]">
              {match.teamBShort.slice(0, 3)}
            </span>
          )}
          <span className="text-[13px] font-black text-[#111827]">{match.teamBShort}</span>
        </div>
      </div>
    </Link>
  );
}

// ── 섹션 래퍼 ─────────────────────────────────────────────────

export function ScheduleSection({ matches }: { matches: ScheduleMatch[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const displayMatches = selectedDate
    ? matches.filter((m) => m.dateKey === selectedDate)
    : matches.filter((m) => m.status !== "completed").slice(0, 8);

  const selectedLabel = selectedDate
    ? (() => {
        const [, mo, d] = selectedDate.split("-").map(Number);
        return `${mo}월 ${d}일 경기`;
      })()
    : "예정 경기";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[500px_1fr]">
      {/* 캘린더 (넓은 쪽) */}
      <MiniCalendar
        matches={matches}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />

      {/* 경기 목록 (좁은 쪽, 세로 스택) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-black text-[#111827]">{selectedLabel}</h2>
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs font-semibold text-[#98a2b3] hover:text-accent"
            >
              전체 보기
            </button>
          )}
        </div>

        {displayMatches.length === 0 ? (
          <div className="rounded-xl border border-[#e8eaf0] bg-white p-8 text-center text-sm text-[#98a2b3]">
            {selectedDate ? "이 날 예정된 경기가 없습니다." : "예정된 경기가 없습니다."}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {displayMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
