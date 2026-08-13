"use client";

import { useEffect, useRef, useState } from "react";

import { TeamLogo } from "@/components/ui/team-logo";
import { OBJECTIVE_ICONS } from "@/lib/objectives";
import type { Team } from "@/lib/types";
import type { LiveMatchParticipant, LiveMatchResponse } from "@/app/api/matches/[matchId]/live/route";

const POLL_INTERVAL_MS = 10_000;

type Side = "blue" | "red";
type LiveSnapshot = Extract<LiveMatchResponse, { status: "live" }>;

type FeedEvent =
  | { id: string; time: number; type: "kill"; killer: LiveMatchParticipant | null; victim: LiveMatchParticipant | null }
  | { id: string; time: number; type: "tower" | "baron" | "inhibitor"; side: Side }
  | { id: string; time: number; type: "dragon"; side: Side; dragonType: string }
  | { id: string; time: number; type: "end" };

const DRAGON_ICON: Record<string, string> = {
  cloud: OBJECTIVE_ICONS.cloud,
  infernal: OBJECTIVE_ICONS.infernal,
  mountain: OBJECTIVE_ICONS.mountain,
  ocean: OBJECTIVE_ICONS.ocean,
  hextech: OBJECTIVE_ICONS.hextech,
  chemtech: OBJECTIVE_ICONS.chemtech,
  elder: OBJECTIVE_ICONS.elder,
};

const DRAGON_LABEL: Record<string, string> = {
  cloud: "바람 드래곤",
  infernal: "화염 드래곤",
  mountain: "대지 드래곤",
  ocean: "바다 드래곤",
  hextech: "마법공학 드래곤",
  chemtech: "화학공학 드래곤",
  elder: "장로 드래곤",
};

function fmtClock(seconds: number | null) {
  if (seconds == null) return "-:--";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function participantKey(participant: LiveMatchParticipant, index: number) {
  return `${participant.side}-${participant.summonerName ?? index}`;
}

function diffEvents(prev: LiveSnapshot, curr: LiveSnapshot): FeedEvent[] {
  const time = curr.durationSeconds ?? 0;
  const events: FeedEvent[] = [];
  const stamp = Date.now();

  (["blue", "red"] as const).forEach((side) => {
    const before = prev[side];
    const after = curr[side];

    for (let i = 0; i < after.towers - before.towers; i++) {
      events.push({ id: `${stamp}-tower-${side}-${i}`, time, type: "tower", side });
    }
    for (let i = 0; i < after.barons - before.barons; i++) {
      events.push({ id: `${stamp}-baron-${side}-${i}`, time, type: "baron", side });
    }
    for (let i = 0; i < after.inhibitors - before.inhibitors; i++) {
      events.push({ id: `${stamp}-inhib-${side}-${i}`, time, type: "inhibitor", side });
    }
    for (const dragonType of after.dragonTypes.slice(before.dragonTypes.length)) {
      events.push({ id: `${stamp}-dragon-${side}-${dragonType}`, time, type: "dragon", side, dragonType });
    }
  });

  const prevByKey = new Map(prev.participants.map((p, i) => [participantKey(p, i), p]));
  const killers: LiveMatchParticipant[] = [];
  const victims: LiveMatchParticipant[] = [];
  curr.participants.forEach((participant, index) => {
    const before = prevByKey.get(participantKey(participant, index));
    if (!before) return;
    for (let i = 0; i < participant.kills - before.kills; i++) killers.push(participant);
    for (let i = 0; i < participant.deaths - before.deaths; i++) victims.push(participant);
  });
  const killCount = Math.max(killers.length, victims.length);
  for (let i = 0; i < killCount; i++) {
    events.push({ id: `${stamp}-kill-${i}`, time, type: "kill", killer: killers[i] ?? null, victim: victims[i] ?? null });
  }

  return events;
}

function ObjectiveRow({ event, teamOf }: { event: FeedEvent; teamOf: (side: Side) => Team | undefined }) {
  if (event.type === "kill") {
    return (
      <>
        <span className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold">
          {event.killer?.summonerName ?? "?"}
        </span>
        <span aria-hidden="true" className="shrink-0 text-[13px]">⚔️</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {event.victim?.summonerName ?? "?"}
        </span>
      </>
    );
  }

  if (event.type === "end") {
    return <span className="min-w-0 flex-1 truncate text-[13px] font-bold">경기 종료</span>;
  }

  const team = teamOf(event.side);
  let icon: string = OBJECTIVE_ICONS.dragon;
  let label = "드래곤";
  switch (event.type) {
    case "tower":
      icon = OBJECTIVE_ICONS.tower;
      label = "타워";
      break;
    case "baron":
      icon = OBJECTIVE_ICONS.baron;
      label = "바론";
      break;
    case "inhibitor":
      icon = OBJECTIVE_ICONS.tower;
      label = "억제기";
      break;
    case "dragon":
      icon = DRAGON_ICON[event.dragonType] ?? OBJECTIVE_ICONS.dragon;
      label = DRAGON_LABEL[event.dragonType] ?? "드래곤";
      break;
  }

  return (
    <>
      <TeamLogo team={team} size="h-5 w-5" plain themeAware />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{team?.shortName ?? "?"}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
      <span className="shrink-0 text-[13px] text-muted">{label}</span>
    </>
  );
}

export function LiveMatchFeed({ matchId, teamA, teamB }: { matchId: string; teamA?: Team; teamB?: Team }) {
  const [status, setStatus] = useState<LiveMatchResponse["status"] | "loading">("loading");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [clock, setClock] = useState<number | null>(null);
  const prevRef = useRef<LiveSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/matches/${matchId}/live`, { cache: "no-store" });
        const data = (await res.json()) as LiveMatchResponse;
        if (cancelled) return;

        if (data.status === "live") {
          setClock(data.durationSeconds);
          if (prevRef.current) {
            const next = diffEvents(prevRef.current, data);
            if (next.length > 0) setEvents((prev) => [...next.reverse(), ...prev].slice(0, 100));
          }
          prevRef.current = data;
        } else if (prevRef.current) {
          // 방금까지 라이브였는데 더 이상 진행 중인 게임을 못 찾으면 경기 종료로 간주한다.
          const endedAt = prevRef.current.durationSeconds ?? 0;
          setEvents((prev) => [{ id: `${Date.now()}-end`, time: endedAt, type: "end" }, ...prev]);
          prevRef.current = null;
        }
        setStatus(data.status);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    }

    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [matchId]);

  const teamOf = (side: Side) => {
    const blueIsA = prevRef.current?.blue.teamId === teamA?.id;
    if (side === "blue") return blueIsA ? teamA : teamB;
    return blueIsA ? teamB : teamA;
  };

  return (
    <section className="rounded-md border border-border bg-surface p-3" aria-label="실시간 경기 피드">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {status === "live" ? (
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-red-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-muted">
              {status === "loading" ? "불러오는 중..." :
                status === "not_started" ? "경기 시작 전입니다" :
                status === "ended" ? "게임이 진행 중이지 않습니다" :
                "실시간 데이터를 가져올 수 없습니다"}
            </span>
          )}
        </div>
        {status === "live" ? (
          <span className="text-[13px] font-semibold tabular-nums text-muted">{fmtClock(clock)}</span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-muted">
          {status === "live" ? "곧 새 소식이 올라옵니다..." : "아직 표시할 이벤트가 없습니다."}
        </p>
      ) : (
        <ol className="flex flex-col">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-2 border-t border-border px-1 py-2 first:border-t-0"
            >
              <span className="w-10 shrink-0 text-[12px] font-semibold tabular-nums text-muted">
                {fmtClock(event.time)}
              </span>
              <ObjectiveRow event={event} teamOf={teamOf} />
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 px-1 text-[11px] text-muted">
        lolesports.com 실시간 데이터를 {POLL_INTERVAL_MS / 1000}초마다 갱신합니다. 킬 상대는 팀 킬/데스 수 변화로 추정한 값이라 정확하지 않을 수 있습니다.
      </p>
    </section>
  );
}
