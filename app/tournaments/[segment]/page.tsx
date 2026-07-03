import Link from "next/link";
import { notFound } from "next/navigation";

import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { buildStageColumns, splitBracketSidesForDisplay } from "@/lib/tournaments/bracket";
import {
  internationalSegmentByKey,
  type InternationalSegmentTheme,
} from "@/lib/tournaments/international-segments";
import { segmentForTournament } from "@/lib/tournaments/season-2026";
import type { Match, Team } from "@/lib/types";
import { formatDateHeaderKST, formatTimeKST, matchHref } from "@/lib/view-data";

import { BracketScroller } from "./bracket-scroller";

function TeamSide({
  team,
  isWinner,
  side,
}: {
  team: Team | undefined;
  isWinner: boolean;
  side: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1.5 ${
        side === "right" ? "flex-row-reverse text-right" : ""
      } ${isWinner ? "font-black text-white" : "font-semibold text-white/60"}`}
    >
      {team?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-white/10" aria-hidden="true" />
      )}
      <span className="truncate text-xs uppercase tracking-wide">{team?.shortName ?? "TBD"}</span>
    </div>
  );
}

function MatchCard({
  match,
  teamMap,
  accent,
}: {
  match: Match;
  teamMap: Map<string, Team>;
  accent: string;
}) {
  const teamA = teamMap.get(match.teamAId);
  const teamB = teamMap.get(match.teamBId);
  const winnerA = match.status === "completed" && match.winnerTeamId === teamA?.id;
  const winnerB = match.status === "completed" && match.winnerTeamId === teamB?.id;

  return (
    <Link
      href={matchHref(match)}
      style={{ borderLeftColor: accent }}
      className="block rounded-md border border-white/10 border-l-2 bg-white/[0.04] p-2 transition-colors hover:bg-white/[0.08]"
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/40">
        <span>
          {formatDateHeaderKST(match.matchDate)} {formatTimeKST(match.matchDate)}
        </span>
        {match.bestOf ? <span>Bo{match.bestOf}</span> : null}
      </div>
      <div className="flex items-center gap-1.5">
        <TeamSide team={teamA} isWinner={winnerA} side="left" />
        <span className="shrink-0 rounded bg-white/10 px-1 py-1 text-xs font-black tabular-nums text-white">
          {match.teamAScore ?? "-"}:{match.teamBScore ?? "-"}
        </span>
        <TeamSide team={teamB} isWinner={winnerB} side="right" />
      </div>
    </Link>
  );
}

function SeasonTabs({
  seasons,
  activeSeason,
  segmentKey,
}: {
  seasons: number[];
  activeSeason: number;
  segmentKey: string;
}) {
  if (seasons.length <= 1) return null;

  return (
    <div className="flex gap-2">
      {seasons.map((season) => (
        <Link
          key={season}
          href={`/tournaments/${segmentKey}?year=${season}`}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
            season === activeSeason
              ? "bg-white text-[#0a0e1a]"
              : "bg-white/10 text-white/60 hover:text-white"
          }`}
        >
          {season}
        </Link>
      ))}
    </div>
  );
}

function BracketHeader({
  segmentTheme,
  activeSeason,
  seasons,
}: {
  segmentTheme: InternationalSegmentTheme;
  activeSeason: number;
  seasons: number[];
}) {
  return (
    <div className="relative flex flex-wrap items-start justify-between gap-4">
      <div>
        <span
          className="text-xs font-black uppercase tracking-[0.3em]"
          style={{ color: segmentTheme.accent }}
        >
          {activeSeason} · International
        </span>
        <h1 className="mt-2 text-4xl font-black uppercase italic tracking-tight text-white md:text-5xl">
          {segmentTheme.name}
        </h1>
        <p className="mt-1 text-sm font-medium text-white/50">{segmentTheme.description}</p>
      </div>

      <SeasonTabs seasons={seasons} activeSeason={activeSeason} segmentKey={segmentTheme.key} />
    </div>
  );
}

export default async function TournamentBracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { segment: segmentKey } = await params;
  const segmentTheme = internationalSegmentByKey(segmentKey);

  if (!segmentTheme) {
    notFound();
  }

  const search = await searchParams;
  const [tournaments, stages, matches, teams] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
  ]);

  const segmentTournaments = tournaments.filter(
    (tournament) => segmentForTournament(tournament) === segmentTheme.key,
  );

  if (segmentTournaments.length === 0) {
    notFound();
  }

  const seasons = [...new Set(segmentTournaments.map((tournament) => tournament.season))].sort(
    (a, b) => b - a,
  );
  const requestedSeason = search.year ? Number(search.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const activeTournaments = segmentTournaments.filter(
    (tournament) => tournament.season === activeSeason,
  );
  const tournamentIds = new Set(activeTournaments.map((tournament) => tournament.id));

  const segmentStages = stages.filter((stage) => tournamentIds.has(stage.tournamentId));
  const segmentMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const columns = buildStageColumns(segmentStages, segmentMatches);
  const columnSplits = new Map(
    columns.map(({ stage, matches: stageMatches }) => [
      stage.id,
      splitBracketSidesForDisplay(stageMatches),
    ]),
  );
  const hasAnyLowerBracket = [...columnSplits.values()].some((split) => split.lower.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <Link href="/tournaments" className="w-fit text-sm font-semibold text-muted hover:text-foreground">
        ← 대회 목록
      </Link>

      <section className="relative overflow-hidden rounded-3xl bg-[#0a0e1a] p-6 shadow-2xl md:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0px, transparent 40px, rgba(255,255,255,0.035) 40px, rgba(255,255,255,0.035) 42px)",
          }}
        />

        <div className="relative flex flex-col gap-8">
          <BracketHeader segmentTheme={segmentTheme} activeSeason={activeSeason} seasons={seasons} />

          {columns.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-white/50">
              아직 공개된 대진표가 없습니다.
            </p>
          ) : (
            <BracketScroller>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  {columns.map(({ stage }) => (
                    <span
                      key={stage.id}
                      className="w-56 shrink-0 rounded-sm px-2 py-1 text-[11px] font-black uppercase tracking-widest text-[#0a0e1a]"
                      style={{ backgroundColor: segmentTheme.accent }}
                    >
                      {stage.name}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  {hasAnyLowerBracket ? (
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/40">
                      승자조
                    </span>
                  ) : null}
                  <div className="flex items-start gap-4">
                    {columns.map(({ stage }) => {
                      const upper = columnSplits.get(stage.id)?.upper ?? [];
                      return (
                        <div key={stage.id} className="flex w-56 shrink-0 snap-start flex-col gap-3">
                          {upper.map((match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              teamMap={teamMap}
                              accent={segmentTheme.accent}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {hasAnyLowerBracket ? (
                  <>
                    <div className="h-px w-full bg-white/15" />

                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-white/40">
                        패자조
                      </span>
                      <div className="flex items-start gap-4">
                        {columns.map(({ stage }) => {
                          const lower = columnSplits.get(stage.id)?.lower ?? [];
                          return (
                            <div key={stage.id} className="flex w-56 shrink-0 flex-col gap-3">
                              {lower.map((match) => (
                                <MatchCard
                                  key={match.id}
                                  match={match}
                                  teamMap={teamMap}
                                  accent={segmentTheme.accent}
                                />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </BracketScroller>
          )}
        </div>
      </section>
    </main>
  );
}
