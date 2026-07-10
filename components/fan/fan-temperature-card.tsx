"use client";

import { Flame, MessageCircleWarning, Timer, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import { heatFanTemperatureAction } from "@/app/fan/[teamSlug]/actions";
import type { FanTemperatureSnapshot } from "@/lib/data/fan-pulse";

export function FanTemperatureCard({
  teamId,
  teamSlug,
  teamName,
  teamColor,
  initialSnapshot,
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  teamColor: string;
  initialSnapshot: FanTemperatureSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleHeat() {
    setMessage(null);
    startTransition(async () => {
      const result = await heatFanTemperatureAction(teamId, teamSlug);
      if (result.ok && result.snapshot) {
        setSnapshot(result.snapshot);
        setMessage("팬온도가 올라갔어요.");
        return;
      }
      setMessage(result.error ?? "온도를 올리지 못했어요.");
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-5 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-archivo text-xs font-black uppercase tracking-[0.18em] text-[var(--ui-muted)]">
                Fan Temperature
              </p>
              <h2 className="mt-1 text-2xl font-black text-[var(--ui-ink)]">{teamName} 팬온도</h2>
            </div>
            <span className="rounded-full px-3 py-1 text-sm font-black text-white" style={{ background: teamColor }}>
              {snapshot.label}
            </span>
          </div>

          <div className="h-4 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${snapshot.score}%`,
                background: `linear-gradient(90deg, ${teamColor}, #ff6b35)`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-archivo text-5xl font-black leading-none text-[var(--ui-ink)]">
              {snapshot.score}
            </span>
            <span className="text-sm font-bold text-[var(--ui-muted)]">최근 24시간 팬 반응 기준</span>
          </div>

          <button
            type="button"
            onClick={handleHeat}
            disabled={isPending}
            className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white transition active:scale-[0.97] disabled:opacity-60"
            style={{ background: teamColor }}
          >
            <Flame size={17} />
            온도 올리기
          </button>
          {message ? <p className="text-sm font-bold text-[var(--ui-muted)]">{message}</p> : null}
        </div>

        <div className="grid grid-cols-3 border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] md:grid-cols-1 md:border-l md:border-t-0">
          <Metric icon={<Flame size={17} />} label="열기" value={snapshot.heatCount24h} />
          <Metric icon={<MessageCircleWarning size={17} />} label="양파" value={snapshot.onionCountActive} />
          <Metric icon={<Timer size={17} />} label="출석" value={snapshot.checkinCountToday} />
          <div className="hidden md:block">
            <Metric icon={<Users size={17} />} label="팬" value={snapshot.fanCount} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 border-b border-[var(--ui-border)] px-4 py-3 last:border-b-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[var(--ui-ink)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold text-[var(--ui-muted)]">{label}</span>
        <span className="font-archivo block text-xl font-black text-[var(--ui-ink)]">
          {value.toLocaleString("ko-KR")}
        </span>
      </span>
    </div>
  );
}
