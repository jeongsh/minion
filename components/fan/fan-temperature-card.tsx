"use client";

import { Flame, MessageCircleWarning, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import { heatFanTemperatureAction } from "@/app/fan/[teamSlug]/actions";
import type { FanTemperatureSnapshot } from "@/lib/data/fan-pulse";

export function FanTemperatureCard({
  variant = "default",
  teamId,
  teamSlug,
  teamName,
  teamColor,
  initialSnapshot,
}: {
  variant?: "default" | "header";
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

  if (variant === "header") {
    return (
      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-3 pb-5 text-sm">
        <div className="flex items-baseline gap-2">
          <h2 className="font-black">지금 {teamName} 팬 반응</h2>
          <strong className="text-xl font-black tabular-nums">{snapshot.score}<span className="ml-1 text-xs font-bold opacity-65">/ 100</span></strong>
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-black">{snapshot.label}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 opacity-80">
          <HeaderMetric icon={<Flame size={14} />} label="응원" value={snapshot.heatCount24h} />
          <HeaderMetric icon={<MessageCircleWarning size={14} />} label="양파" value={snapshot.onionCountActive} />
          <HeaderMetric icon={<Timer size={14} />} label="출석" value={snapshot.checkinCountToday} />
        </div>
        <button
          type="button"
          onClick={handleHeat}
          disabled={isPending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--team-on-primary)] px-3.5 py-2 text-xs font-black text-[var(--team-primary)] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        >
          <Flame size={15} />온도 올리기
        </button>
        {message ? <p aria-live="polite" className="w-full text-xs font-bold opacity-75">{message}</p> : null}
      </div>
    );
  }

  return (
    <section className="py-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[var(--ui-ink)]">지금 {teamName} 팬 반응</h2>
              <p className="mt-1 text-xs font-bold text-[var(--ui-muted)]">최근 24시간 응원·양파·출석을 합산한 분위기예요.</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-[var(--ui-ink)]"><span style={{ color: "var(--team-accent-text)" }}>{snapshot.score}</span><span className="text-sm text-[var(--ui-muted)]"> / 100</span></p>
          </div>
          <div className="relative mt-4 h-2 overflow-visible rounded-full bg-[var(--ui-surface-muted)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${snapshot.score}%`,
                background: teamColor,
              }}
            />
            <span className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--team-accent-text)]" style={{ left: `max(2px, ${snapshot.score}%)` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Metric icon={<Flame size={15} />} label="응원" value={snapshot.heatCount24h} />
            <Metric icon={<MessageCircleWarning size={15} />} label="양파" value={snapshot.onionCountActive} />
            <Metric icon={<Timer size={15} />} label="출석" value={snapshot.checkinCountToday} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span className="rounded-full bg-[var(--team-accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--team-accent-text)]">{snapshot.label}</span>
          <button
            type="button"
            onClick={handleHeat}
            disabled={isPending}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--team-primary)] px-4 py-2.5 text-sm font-black text-[var(--team-on-primary)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-accent-text)] focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60"
          >
            <Flame size={17} />
            온도 올리기
          </button>
          {message ? <p aria-live="polite" className="w-full text-xs font-bold text-[var(--ui-muted)] lg:text-right">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}

function HeaderMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <span className="inline-flex items-center gap-1">{icon}{label} <strong className="tabular-nums">{value.toLocaleString("ko-KR")}</strong></span>;
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
    <div className="inline-flex items-center gap-1.5 text-[var(--ui-muted)]">
      {icon}<span className="font-bold">{label}</span><strong className="tabular-nums text-[var(--ui-ink)]">{value.toLocaleString("ko-KR")}</strong>
    </div>
  );
}
