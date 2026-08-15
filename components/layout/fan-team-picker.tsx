"use client";

import Link from "next/link";
import { ChevronRight, Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Team } from "@/lib/types";

const RECENT_FAN_TEAM_KEY = "minion-recent-fan-team";

function TeamGrid({ teams }: { teams: Team[] }) {
  return (
    <div className="grid grid-cols-5 gap-x-1 gap-y-2">
      {teams.map((team) => (
        <Link
          key={team.id}
          href={`/fan/${team.fanSiteHost}`}
          className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center transition active:scale-[0.96] hover:bg-[var(--ui-card-hover)]"
          aria-label={`${team.name} 팬페이지로 이동`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white">
            <TeamLogo team={team} size="h-7 w-7" plain />
          </span>
          <span className="w-full truncate text-[11px] font-medium text-[var(--ui-ink)]">{team.shortName}</span>
        </Link>
      ))}
    </div>
  );
}

export function FanTeamPicker({
  teams,
  followedTeams,
  currentTeam,
  active,
  className,
}: {
  teams: Team[];
  followedTeams: Team[];
  currentTeam?: Team | null;
  active: boolean;
  className: string;
}) {
  const [recentTeamId, setRecentTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (currentTeam) {
      localStorage.setItem(RECENT_FAN_TEAM_KEY, currentTeam.id);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setRecentTeamId(localStorage.getItem(RECENT_FAN_TEAM_KEY));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentTeam]);

  const recentTeam = useMemo(
    () => currentTeam ?? teams.find((team) => team.id === recentTeamId) ?? null,
    [currentTeam, recentTeamId, teams],
  );
  const orderedTeams = useMemo(() => {
    const seen = new Set<string>();
    return [recentTeam, ...followedTeams, ...teams].filter((team): team is Team => {
      if (!team || seen.has(team.id)) return false;
      seen.add(team.id);
      return true;
    });
  }, [followedTeams, recentTeam, teams]);

  return (
    <AdaptiveDialog
      title="팬페이지 바로가기"
      triggerAriaLabel="팬페이지 팀 선택"
      triggerAriaCurrent={active ? "page" : undefined}
      triggerClassName={className}
      panelClassName="sm:max-w-[420px]"
      trigger={
        <>
          <span className="relative grid h-5 w-5 place-items-center">
            <Heart size={20} strokeWidth={active ? 2.5 : 2} />
          </span>
          <span className="max-w-full truncate">팬</span>
        </>
      }
    >
      <section aria-label="팀 선택">
        <TeamGrid teams={orderedTeams} />
      </section>

      <Link href="/teams" className="mt-2 flex min-h-11 items-center justify-center gap-1 border-t border-[var(--ui-border)] pt-2 text-[13px] font-bold text-[var(--ui-muted)]">
        소셜과 영상까지 둘러보기 <ChevronRight size={15} />
      </Link>
    </AdaptiveDialog>
  );
}
