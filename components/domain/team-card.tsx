import Link from "next/link";
import type { Team } from "@/lib/types";

export function TeamCard({ team }: { team: Team }) {
  return (
    <article className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{team.shortName}</p>
          <h2 className="mt-1 text-xl font-semibold">{team.name}</h2>
        </div>
        <span
          aria-hidden="true"
          className="h-10 w-10 rounded-md border border-border"
          style={{ background: team.primaryColor }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/teams/${team.slug}`}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          팀 상세
        </Link>
        <Link
          href={`/fan/${team.slug}`}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"
        >
          팬 사이트
        </Link>
      </div>
    </article>
  );
}
