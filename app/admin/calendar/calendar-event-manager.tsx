"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CalendarEventType, FanCalendarEventRow } from "@/lib/calendar/events";
import { createCalendarEventAction, deleteCalendarEventAction } from "./actions";

type TeamOption = { id: string; name: string; shortName: string };
type PlayerOption = { id: string; name: string; teamId: string };

const TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = [
  { value: "debut", label: "데뷔" },
  { value: "championship", label: "우승" },
  { value: "custom", label: "기념일" },
];

const TYPE_LABEL: Record<CalendarEventType, string> = {
  birthday: "생일",
  debut: "데뷔",
  championship: "우승",
  custom: "기념일",
};

const inputClass =
  "h-10 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm text-[var(--ui-ink)] outline-none focus:border-[var(--ui-muted)]";

export function CalendarEventManager({
  events,
  teams,
  players,
}: {
  events: FanCalendarEventRow[];
  teams: TeamOption[];
  players: PlayerOption[];
}) {
  const [teamId, setTeamId] = useState("");
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const filteredPlayers = useMemo(
    () => (teamId ? players.filter((p) => p.teamId === teamId) : players),
    [players, teamId],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* 등록 폼 */}
      <form
        action={createCalendarEventAction}
        className="grid gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-[13px] font-bold text-[var(--ui-muted)]">
          종류
          <select name="event_type" className={inputClass} defaultValue="debut">
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-bold text-[var(--ui-muted)]">
          날짜 (YYYY-MM-DD)
          <input type="date" name="event_date" required className={inputClass} />
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-bold text-[var(--ui-muted)]">
          팀
          <select
            name="team_id"
            className={inputClass}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">선택 안 함</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-bold text-[var(--ui-muted)]">
          선수 (선택)
          <select name="player_id" className={inputClass} defaultValue="">
            <option value="">선택 안 함</option>
            {filteredPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-bold text-[var(--ui-muted)] sm:col-span-2">
          제목 (예: 데뷔, 월즈 우승)
          <input type="text" name="title" required placeholder="데뷔" className={inputClass} />
        </label>

        <label className="flex items-center gap-2 text-[13px] font-bold text-[var(--ui-muted)] sm:col-span-2">
          <input type="checkbox" name="is_recurring" value="true" defaultChecked className="h-4 w-4" />
          매년 반복 (월·일 기준으로 D-day 표시)
        </label>

        <div className="sm:col-span-2">
          <Button type="submit" variant="neutral">
            기념일 등록
          </Button>
        </div>
      </form>

      {/* 목록 */}
      <div className="overflow-hidden rounded-2xl border border-[var(--ui-border)]">
        <div className="grid grid-cols-[80px_110px_1fr_1fr_60px] gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-2.5 text-[13px] font-black text-[var(--ui-muted)]">
          <span>종류</span>
          <span>날짜</span>
          <span>제목</span>
          <span>팀 / 선수</span>
          <span className="text-right">삭제</span>
        </div>
        {events.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--ui-muted)]">등록된 기념일이 없습니다.</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[80px_110px_1fr_1fr_60px] items-center gap-2 border-b border-[var(--ui-border)] px-4 py-3 text-sm text-[var(--ui-ink)] last:border-0"
            >
              <span className="font-bold">{TYPE_LABEL[event.eventType]}</span>
              <span className="tabular-nums text-[var(--ui-muted)]">{event.eventDate}</span>
              <span className="truncate font-semibold">
                {event.title}
                {event.isRecurring ? "" : " (1회)"}
              </span>
              <span className="truncate text-[var(--ui-muted)]">
                {[
                  event.teamId ? teamById.get(event.teamId)?.shortName : null,
                  event.playerId ? playerById.get(event.playerId)?.name : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </span>
              <form action={deleteCalendarEventAction} className="text-right">
                <input type="hidden" name="id" value={event.id} />
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 text-[13px] font-bold text-[#ff3158] hover:bg-[#ff31581a]"
                >
                  삭제
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
