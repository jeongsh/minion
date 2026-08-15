import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { TeamLogo } from "@/components/ui/team-logo";
import type { Team } from "@/lib/types";

export function TeamCard({ team }: { team: Team }) {
  return (
    <article className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] transition-shadow hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--ui-ink)_8%,transparent)]">
      <Link
        href={`/teams?team=${encodeURIComponent(team.fanSiteHost || team.slug)}`}
        className="group flex min-h-[92px] items-center gap-3 px-4 py-4 transition-colors hover:bg-[var(--ui-surface-muted)] sm:min-h-36 sm:gap-5 sm:px-6 sm:py-6"
      >
        <TeamLogo team={team} size="h-14 w-14 sm:h-24 sm:w-24" plain themeAware />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            {team.shortName}
          </p>
          <h2 className="mt-1 text-lg font-black leading-6 text-[var(--ui-ink)] sm:text-lg">
            {team.name}
          </h2>
          <p className="mt-1 truncate text-[12px] font-medium text-[var(--ui-muted)] sm:mt-2 sm:text-[13px]">
            {team.headCoach ? `감독 ${team.headCoach}` : "LCK 공식 참가팀"}
          </p>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="shrink-0 text-[var(--ui-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--ui-ink)]"
          size={20}
        />
      </Link>

      <div className="border-t border-[var(--ui-border)] px-4 sm:px-6">
        <Link
          href={`/fan/${team.fanSiteHost || team.slug}`}
          className="flex min-h-12 items-center justify-between text-[13px] font-black text-[var(--ui-text)] transition-colors hover:text-[var(--ui-ink)] active:bg-[var(--ui-surface-muted)]"
        >
          <span>팬 채널 바로가기</span>
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </article>
  );
}
