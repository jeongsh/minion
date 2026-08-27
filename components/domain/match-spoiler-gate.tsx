"use client";

import { EyeOff } from "lucide-react";
import type { ReactNode } from "react";

import { useSpoilerFree } from "@/lib/spoiler-free/spoiler-free-context";

export function MatchSpoilerGate({
  matchId,
  finished,
  teamALabel,
  teamBLabel,
  children,
}: {
  matchId: string;
  finished: boolean;
  teamALabel: string;
  teamBLabel: string;
  children: ReactNode;
}) {
  const { enabled, isRevealed, reveal } = useSpoilerFree();
  const spoiled = enabled && finished && !isRevealed(matchId);

  if (!spoiled) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--ui-card-radius)] bg-[var(--ui-surface-muted)] px-6 py-16 text-center">
      <EyeOff size={28} strokeWidth={1.6} className="text-[var(--ui-muted)]" />
      <div>
        <p className="font-semibold text-[var(--ui-ink)]">이 경기 결과가 가려져 있어요</p>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">{teamALabel} vs {teamBLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => reveal(matchId)}
        className="rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-sm font-semibold text-[var(--ui-text)] hover:border-[var(--ui-ink)] hover:text-[var(--ui-ink)]"
      >
        결과 보기
      </button>
    </div>
  );
}
