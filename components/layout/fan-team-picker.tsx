"use client";

import Link from "next/link";
import { Heart, Shield } from "lucide-react";
import { useMemo } from "react";

import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Team } from "@/lib/types";

function TeamGrid({ teams, followedIds }: { teams: Team[]; followedIds?: Set<string> }) {
  return (
    <div className="grid grid-cols-5 gap-x-1 gap-y-2">
      {teams.map((team) => {
        const following = followedIds?.has(team.id) ?? false;
        return (
          <Link
            prefetch={false}
            key={team.id}
            href={`/fan/${team.fanSiteHost}`}
            data-following={following ? "true" : undefined}
            className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center transition active:scale-[0.96] hover:bg-[var(--ui-card-hover)]`}
            aria-label={`${team.name}${following ? " (팔로잉)" : ""} 팬페이지로 이동`}
          >
            <span className={`relative grid h-10 w-10 place-items-center rounded-full bg-white ring-2 ring-offset-2 ring-offset-[var(--ui-surface)] ${following ? "ring-[var(--accent)]" : "ring-[var(--ui-border)]"}`}>
              <TeamLogo team={team} size="h-8 w-8" plain />
              {following ? (
                <span aria-hidden className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <Heart size={9} fill="currentColor" strokeWidth={0} />
                </span>
              ) : null}
            </span>
            <span className="w-full truncate text-[13px] font-medium text-[var(--ui-ink)]">{team.shortName}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function TeamPicker({
  teams,
  followedTeams,
  favoriteTeam,
  active,
  className,
}: {
  teams: Team[];
  followedTeams: Team[];
  favoriteTeam?: Team | null;
  active: boolean;
  className: string;
}) {
  const followedIds = useMemo(() => new Set(followedTeams.map((team) => team.id)), [followedTeams]);
  const orderedTeams = useMemo(() => {
    const seen = new Set<string>();
    return [favoriteTeam, ...followedTeams, ...teams].filter((team): team is Team => {
      if (!team || seen.has(team.id)) return false;
      seen.add(team.id);
      return true;
    });
  }, [favoriteTeam, followedTeams, teams]);

  return (
    <AdaptiveDialog
      title="팀"
      triggerAriaLabel="팀 선택"
      triggerAriaCurrent={active ? "page" : undefined}
      triggerClassName={className}
      panelClassName="sm:max-w-[420px]"
      trigger={
        <>
          <span className={`relative grid place-items-center ${favoriteTeam ? "-mt-5 h-10 w-10 overflow-hidden rounded-full border-[3px] border-[var(--page-background)] bg-[var(--ui-surface-muted)]" : "h-5 w-5"}`}>
            {favoriteTeam ? <TeamLogo team={favoriteTeam} size="h-7 w-7" themeAware plain /> : <Shield size={20} strokeWidth={active ? 2.5 : 2} />}
          </span>
          <span className="max-w-full truncate">팀</span>
        </>
      }
    >
      <section aria-label="팀 선택">
        <TeamGrid teams={orderedTeams} followedIds={followedIds} />
      </section>
    </AdaptiveDialog>
  );
}
