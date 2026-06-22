"use client";

import { useState } from "react";
import Link from "next/link";

export type MatchData = {
  id: string;
  matchDate: string;
  status: string;
  bestOf?: number | null;
  href: string;
  teamA?: { name: string; shortName: string; logoUrl?: string };
  teamB?: { name: string; shortName: string; logoUrl?: string };
  standingA?: { rank: number; wins: number; losses: number; winRate: number };
  standingB?: { rank: number; wins: number; losses: number; winRate: number };
};

function formatDateTime(dateStr: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateStr));
}

function MatchCard({ match }: { match: MatchData }) {
  const isLive = match.status === "live";
  const wrA = match.standingA?.winRate ?? 0.5;
  const wrB = match.standingB?.winRate ?? 0.5;
  const total = wrA + wrB || 1;
  const probA = Math.round((wrA / total) * 100);
  const probB = 100 - probA;
  const favorA = probA >= probB;

  return (
    <Link
      href={match.href}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#e8eaf0] bg-white transition-all hover:border-[#c7cbda] hover:shadow-md"
    >
      <div className="flex items-center justify-between border-b border-[#f0f2f5] px-4 py-3">
        <span className="text-xs font-semibold text-[#98a2b3]">
          {formatDateTime(match.matchDate)}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
            isLive ? "bg-red-50 text-red-500" : "bg-[#f0f2f5] text-[#667085]"
          }`}
        >
          {isLive ? "● LIVE" : match.bestOf ? `BO${match.bestOf}` : "예정"}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5 px-4 py-7">
        <div className="flex flex-col items-center gap-2.5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f8f9fc] p-2">
            {match.teamA?.logoUrl ? (
              <img
                src={match.teamA.logoUrl}
                alt={match.teamA.name}
                className="h-full w-full object-contain transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="text-lg font-black text-[#98a2b3]">
                {match.teamA?.shortName?.slice(0, 3) ?? "?"}
              </span>
            )}
          </div>
          <div className="text-center">
            <p className="text-base font-black text-[#111827]">
              {match.teamA?.shortName ?? "-"}
            </p>
            {match.standingA && (
              <p className="text-[11px] text-[#98a2b3]">
                {match.standingA.rank}위 · {match.standingA.wins}승 {match.standingA.losses}패
              </p>
            )}
          </div>
        </div>

        <span className="text-sm font-black text-[#d0d5dd]">vs</span>

        <div className="flex flex-col items-center gap-2.5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f8f9fc] p-2">
            {match.teamB?.logoUrl ? (
              <img
                src={match.teamB.logoUrl}
                alt={match.teamB.name}
                className="h-full w-full object-contain transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="text-lg font-black text-[#98a2b3]">
                {match.teamB?.shortName?.slice(0, 3) ?? "?"}
              </span>
            )}
          </div>
          <div className="text-center">
            <p className="text-base font-black text-[#111827]">
              {match.teamB?.shortName ?? "-"}
            </p>
            {match.standingB && (
              <p className="text-[11px] text-[#98a2b3]">
                {match.standingB.rank}위 · {match.standingB.wins}승 {match.standingB.losses}패
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#f0f2f5] bg-[#f8f9fc] px-4 py-4">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-sm">✨</span>
          <span className="text-[11px] font-black text-[#667085]">AI 프리뷰</span>
          <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-black text-accent">
            {favorA ? match.teamA?.shortName : match.teamB?.shortName} 예상 승리
          </span>
        </div>
        <div className="flex overflow-hidden rounded-full">
          <div
            className="h-2 rounded-l-full bg-accent transition-all"
            style={{ width: `${probA}%` }}
          />
          <div
            className="h-2 rounded-r-full bg-[#d0d5dd] transition-all"
            style={{ width: `${probB}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span
            className={`text-[11px] font-black ${favorA ? "text-accent" : "text-[#98a2b3]"}`}
          >
            {match.teamA?.shortName} {probA}%
          </span>
          <span
            className={`text-[11px] font-black ${!favorA ? "text-accent" : "text-[#98a2b3]"}`}
          >
            {probB}% {match.teamB?.shortName}
          </span>
        </div>
      </div>
    </Link>
  );
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function MatchPreviewSection({
  allMatches,
  defaultMatches,
}: {
  allMatches: MatchData[];
  defaultMatches: MatchData[];
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // day → matches map for current month
  const matchDayMap = new Map<number, MatchData[]>();
  for (const m of allMatches) {
    const d = new Date(m.matchDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!matchDayMap.has(day)) matchDayMap.set(day, []);
      matchDayMap.get(day)!.push(m);
    }
  }

  const displayMatches =
    selectedDay != null ? (matchDayMap.get(selectedDay) ?? []) : defaultMatches;

  // calendar grid
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(today);

  function toggleDay(day: number) {
    setSelectedDay((prev) => (prev === day ? null : day));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-black text-[#111827]">예정 경기</h2>
        <Link
          href="/schedule"
          className="text-xs font-semibold text-[#98a2b3] hover:text-accent"
        >
          전체 일정 →
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        {/* 경기 카드 */}
        {displayMatches.length === 0 ? (
          <p className="rounded-xl border border-[#e8eaf0] bg-white p-8 text-center text-sm text-[#98a2b3]">
            {selectedDay != null
              ? `${selectedDay}일에는 경기가 없습니다.`
              : "예정된 경기가 없습니다."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {displayMatches.slice(0, 4).map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}

        {/* 캘린더 */}
        <div className="rounded-xl border border-[#e8eaf0] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-black text-[#111827]">{monthLabel}</p>
            {selectedDay != null && (
              <button
                onClick={() => setSelectedDay(null)}
                className="text-[11px] font-semibold text-[#98a2b3] hover:text-accent"
              >
                전체 보기
              </button>
            )}
          </div>

          <div className="grid grid-cols-7 text-center">
            {DOW.map((d) => (
              <div key={d} className="pb-2 text-xs font-bold text-[#98a2b3]">
                {d}
              </div>
            ))}

            {cells.map((day, i) => {
              const col = i % 7;
              const isToday = day === today.getDate();
              const isSelected = day === selectedDay;
              const hasMatch = day != null && matchDayMap.has(day);

              let numCls = "";
              if (day == null) {
                numCls = "";
              } else if (isSelected) {
                numCls = "bg-accent text-white font-black";
              } else if (isToday) {
                numCls = "ring-2 ring-accent text-accent font-black";
              } else if (col === 0) {
                numCls = "text-red-400 font-semibold";
              } else if (col === 6) {
                numCls = "text-blue-400 font-semibold";
              } else {
                numCls = "text-[#111827]";
              }

              return (
                <div key={i} className="flex flex-col items-center gap-1 py-1">
                  <button
                    type="button"
                    disabled={!hasMatch}
                    onClick={() => day != null && hasMatch && toggleDay(day)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${numCls} ${
                      hasMatch && !isSelected
                        ? "cursor-pointer hover:bg-[#f0f2f5]"
                        : "disabled:cursor-default"
                    }`}
                  >
                    {day ?? ""}
                  </button>
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-opacity ${
                      hasMatch
                        ? isSelected
                          ? "bg-accent opacity-100"
                          : "bg-accent opacity-60"
                        : "opacity-0"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
