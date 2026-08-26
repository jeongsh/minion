"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setFavoriteTeamAction } from "@/app/fan/[teamSlug]/actions";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Team } from "@/lib/types";

type FavoriteTeamOption = Pick<
  Team,
  "id" | "slug" | "name" | "shortName" | "logoUrl" | "logoWhiteUrl" | "useWhiteLogoOnDark" | "fanSiteHost"
>;

export function FavoriteTeamStep({ teams, next = "/me" }: { teams: FavoriteTeamOption[]; next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectTeam(team: FavoriteTeamOption) {
    if (pending) return;
    setPendingTeamId(team.id);
    setError(null);
    startTransition(async () => {
      const result = await setFavoriteTeamAction(team.id, team.fanSiteHost || team.slug, true);
      if (!result.ok) {
        setPendingTeamId(null);
        setError(result.error ?? "최애팀을 저장하지 못했습니다. 잠시 뒤 다시 시도해주세요.");
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5" aria-label="최애팀 선택">
        {teams.map((team) => {
          const isPending = pendingTeamId === team.id;
          return (
            <li key={team.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => selectTeam(team)}
                className="group relative flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-3 text-center transition hover:border-[var(--accent)] hover:bg-[var(--ui-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
                aria-label={`${team.name}을 최애팀으로 선택`}
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white p-2">
                  <TeamLogo team={team} size="h-10 w-10" plain />
                </span>
                <span className="w-full truncate text-sm font-medium text-[var(--ui-ink)]">{team.shortName}</span>
                {isPending ? (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-[var(--ui-border)] text-transparent transition group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                    <Check size={14} aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p role="alert" className="text-center text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => router.replace(next)}
        className="min-h-11 rounded-xl px-4 text-sm font-medium text-[var(--ui-muted)] underline underline-offset-4 transition hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] disabled:opacity-50"
      >
        아직 최애팀이 없어요 · 건너뛰기
      </button>
    </div>
  );
}
