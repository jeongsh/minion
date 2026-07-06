import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { TeamLogo } from "@/components/ui/team-logo";
import type { Team } from "@/lib/types";

export function TeamCard({ team }: { team: Team }) {
  return (
    <article className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] transition-shadow hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--ui-ink)_8%,transparent)]">
      <Link
        href={`/teams/${team.slug}`}
        className="group flex min-h-36 items-center gap-5 px-5 py-6 transition-colors hover:bg-[var(--ui-surface-muted)] sm:px-6"
      >
        <TeamLogo team={team} size="h-20 w-20 sm:h-24 sm:w-24" plain />

        <div className="min-w-0 flex-1">
          <p className="font-archivo text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-muted)]">
            {team.shortName}
          </p>
          <h2 className="mt-1 text-base font-black leading-6 text-[var(--ui-ink)] sm:text-lg">
            {team.name}
          </h2>
          <p className="mt-2 truncate text-xs font-semibold text-[var(--ui-muted)]">
            {team.headCoach ? `감독 ${team.headCoach}` : "LCK 공식 참가팀"}
          </p>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="shrink-0 text-[var(--ui-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--ui-ink)]"
          size={20}
        />
      </Link>

      <div className="border-t border-[var(--ui-border)] px-5 sm:px-6">
        <Link
          href={`/fan/${team.fanSiteHost || team.slug}`}
          className="flex min-h-12 items-center justify-between text-xs font-black text-[var(--ui-text)] transition-colors hover:text-[var(--ui-ink)] active:bg-[var(--ui-surface-muted)]"
        >
          <span>팬 채널 바로가기</span>
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </article>
  );
}
