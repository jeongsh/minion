import Link from "next/link";

import { matchStatusLabel, stageName, tournamentTypeLabel } from "@/lib/match-display";
import type { Match, Stage, Team, Tournament } from "@/lib/types";
import { formatTimeKST, KST_TIMEZONE, matchHref } from "@/lib/view-data";

function dateHeading(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(value));
}

function TeamLogo({ team }: { team?: Team }) {
  if (team?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logoUrl} alt="" aria-hidden className="size-12 shrink-0 object-contain" />;
  }
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded bg-[var(--surface-1)] text-[10px] font-bold">
      {team?.shortName?.slice(0, 3) ?? "TBD"}
    </span>
  );
}

export function ScheduleList({
  matches,
  teams,
  tournaments,
  stages,
  emptyMessage,
}: {
  matches: Match[];
  teams: Team[];
  tournaments: Tournament[];
  stages: Stage[];
  emptyMessage: string;
}) {
  const groups = matches.reduce<Record<string, Match[]>>((result, match) => {
    const key = dateHeading(match.matchDate);
    return { ...result, [key]: [...(result[key] ?? []), match] };
  }, {});

  if (matches.length === 0) {
    return <p className="py-16 text-center text-sm text-[var(--ink-3)]">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-10 pb-1">
      {Object.entries(groups).map(([date, dayMatches]) => (
        <section key={date} className="flex flex-col gap-0.5">
          <h2 className="section-rule pb-2 text-xl font-black leading-none tracking-tight text-[var(--ink)]">{date}</h2>
          <div>
            {dayMatches.map((match) => {
              const teamA = teams.find((team) => team.id === match.teamAId);
              const teamB = teams.find((team) => team.id === match.teamBId);
              const tournament = tournaments.find((item) => item.id === match.tournamentId);
              const score = match.teamAScore === null || match.teamBScore === null
                ? "vs"
                : `${match.teamAScore} : ${match.teamBScore}`;

              return (
                <Link
                  href={matchHref(match)}
                  key={match.id}
                  className="row-hover grid grid-cols-1 items-center gap-3 border-b border-[var(--hairline)] px-2 py-4 transition-colors md:grid-cols-[250px_minmax(0,1fr)_250px] md:gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex w-[66px] shrink-0 flex-col gap-1">
                      <time className="text-lg font-black tracking-tight text-[var(--ink)]">{formatTimeKST(match.matchDate)}</time>
                      <span className="w-fit rounded bg-[var(--ink)] px-2 py-0.5 text-xs font-semibold text-white">
                        {matchStatusLabel(match.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3.5">
                    <p className="flex min-w-0 flex-1 justify-end text-sm font-black"><span className="truncate">{teamA?.name ?? "TBD"}</span></p>
                    <TeamLogo team={teamA} />
                    <p className="w-16 shrink-0 text-center text-2xl font-black tabular-nums text-[var(--ink)]">{score}</p>
                    <TeamLogo team={teamB} />
                    <p className="flex min-w-0 flex-1 text-sm font-black"><span className="truncate">{teamB?.name ?? "TBD"}</span></p>
                  </div>
                  <div className="flex flex-col text-right">
                    <p className="truncate text-sm font-bold text-[var(--ink-2)]">{tournamentTypeLabel(tournament)}</p>
                    <p className="truncate text-sm font-semibold text-[var(--sub-muted)]">{stageName(stages, match.stageId)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
