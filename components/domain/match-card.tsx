import Link from "next/link";
import type { Match, Team } from "@/lib/types";
import { formatDateTime, teamLabel } from "@/lib/view-data";

export function MatchCard({ match, teams = [] }: { match: Match; teams?: Team[] }) {
  return (
    <article className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatDateTime(match.matchDate)}</p>
          <h2 className="mt-2 text-lg font-semibold">{match.name}</h2>
        </div>
        <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
          {match.status}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <span>{teamLabel(teams, match.teamAId)}</span>
        <strong>
          {match.teamAScore ?? "-"} : {match.teamBScore ?? "-"}
        </strong>
        <span className="text-right">{teamLabel(teams, match.teamBId)}</span>
      </div>
      <Link
        href={`/matches/${match.id}`}
        className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
      >
        경기 상세 보기
      </Link>
    </article>
  );
}
