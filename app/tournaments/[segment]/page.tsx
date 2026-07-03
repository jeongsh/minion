import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { buildStageColumns, splitBracketSidesForDisplay, type StageColumn } from "@/lib/tournaments/bracket";
import { internationalSegmentByKey } from "@/lib/tournaments/international-segments";
import { segmentForTournament } from "@/lib/tournaments/season-2026";
import type { Match, Team } from "@/lib/types";
import { formatDateHeaderKST, formatTimeKST, matchHref } from "@/lib/view-data";

import { BracketConnectors, type BracketConnection } from "./bracket-connectors";
import { BracketScroller } from "./bracket-scroller";

function isFinalsStage(stageName: string) {
  return stageName.trim().toLowerCase() === "finals";
}

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
      } ${isWinner ? "font-black text-foreground" : "font-semibold text-muted"}`}
    >
      {team?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-surface-muted" aria-hidden="true" />
      )}
      <span className="truncate text-xs uppercase tracking-wide">{team?.shortName ?? "미정"}</span>
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
      data-match-id={match.id}
      style={{ borderLeftColor: accent }}
      className="block rounded-md border border-border border-l-2 bg-surface p-2 transition-colors hover:border-accent"
    >
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted">
        <span>
          {formatDateHeaderKST(match.matchDate)} {formatTimeKST(match.matchDate)}
        </span>
        {match.bestOf ? <span>Bo{match.bestOf}</span> : null}
      </div>
      <div className="flex items-center gap-1.5">
        <TeamSide team={teamA} isWinner={winnerA} side="left" />
        <span className="shrink-0 rounded bg-surface-muted px-1 py-1 text-xs font-black tabular-nums text-foreground">
          {match.teamAScore ?? "-"}:{match.teamBScore ?? "-"}
        </span>
        <TeamSide team={teamB} isWinner={winnerB} side="right" />
      </div>
    </Link>
  );
}

function FinalsTeamRow({
  team,
  placeholder,
  score,
  isWinner,
}: {
  team: Team | undefined;
  placeholder: string;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 ${
        isWinner ? "bg-accent text-accent-foreground" : "bg-surface-muted font-semibold text-muted"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {team?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full bg-surface" aria-hidden="true" />
        )}
        <span className="truncate text-sm">{team?.shortName ?? placeholder}</span>
      </span>
      <span className="shrink-0 tabular-nums text-sm">{score ?? "-"}</span>
    </div>
  );
}

function GrandFinalsCard({
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
      data-match-id={match.id}
      style={{ borderColor: accent }}
      className="flex h-full flex-col justify-center gap-3 rounded-lg border-2 bg-surface p-4 transition-colors hover:bg-surface-muted"
    >
      <span className="text-center text-xs font-black uppercase tracking-[0.25em]" style={{ color: accent }}>
        Grand Finals
      </span>
      <div className="flex flex-col gap-2">
        <FinalsTeamRow team={teamA} placeholder="승자조 경기 승자" score={match.teamAScore} isWinner={winnerA} />
        <FinalsTeamRow team={teamB} placeholder="결승 진출전 승자" score={match.teamBScore} isWinner={winnerB} />
      </div>
      <div className="text-center text-[11px] font-semibold text-muted">
        {formatDateHeaderKST(match.matchDate)} {formatTimeKST(match.matchDate)}
        {match.bestOf ? ` · Bo${match.bestOf}` : ""}
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
              ? "bg-accent text-accent-foreground"
              : "bg-surface-muted text-muted hover:text-foreground"
          }`}
        >
          {season}
        </Link>
      ))}
    </div>
  );
}

const UPPER_LABEL_ROW = 1;
const UPPER_ROW = 2;
const LOWER_LABEL_ROW = 3;
const LOWER_ROW = 4;

function BracketGrid({
  columns,
  teamMap,
  accent,
}: {
  columns: StageColumn[];
  teamMap: Map<string, Team>;
  accent: string;
}) {
  const finalsIndex = columns.findIndex((column) => isFinalsStage(column.stage.name));
  const finalsColumn = finalsIndex >= 0 ? columns[finalsIndex] : null;
  const regularColumns = finalsIndex >= 0 ? columns.filter((_, index) => index !== finalsIndex) : columns;

  const columnSplits = new Map(
    regularColumns.map((column) => [column.stage.id, splitBracketSidesForDisplay(column.matches)]),
  );
  const hasAnyLowerBracket = [...columnSplits.values()].some((split) => split.lower.length > 0);
  const finalsMatch = finalsColumn?.matches[0];

  const connections: BracketConnection[] = [];
  for (const column of columns) {
    for (const match of column.matches) {
      if (match.advancesToMatchId) {
        connections.push({ fromMatchId: match.id, toMatchId: match.advancesToMatchId });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {regularColumns.map(({ stage }) => (
          <span key={stage.id} className="w-56 shrink-0 text-sm font-black text-foreground">
            {stage.name}
          </span>
        ))}
      </div>

      <BracketConnectors connections={connections} accent={accent}>
        <div
          className="grid gap-x-4 gap-y-3"
          style={{
            gridTemplateColumns: `repeat(${regularColumns.length}, 14rem)${
              finalsColumn ? " 15rem" : ""
            }`,
          }}
        >
          {hasAnyLowerBracket ? (
            <span
              style={{ gridColumn: `1 / ${regularColumns.length + 1}`, gridRow: UPPER_LABEL_ROW }}
              className="text-[11px] font-black uppercase tracking-widest text-muted"
            >
              승자조
            </span>
          ) : null}

          {regularColumns.map(({ stage }, index) => {
            const upper = columnSplits.get(stage.id)?.upper ?? [];
            return (
              <div
                key={stage.id}
                style={{ gridColumn: index + 1, gridRow: UPPER_ROW }}
                className="flex snap-start flex-col gap-3"
              >
                {upper.map((match) => (
                  <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} />
                ))}
              </div>
            );
          })}

          {hasAnyLowerBracket ? (
            <>
              <span
                style={{ gridColumn: `1 / ${regularColumns.length + 1}`, gridRow: LOWER_LABEL_ROW }}
                className="text-[11px] font-black uppercase tracking-widest text-muted"
              >
                패자조
              </span>
              {regularColumns.map(({ stage }, index) => {
                const lower = columnSplits.get(stage.id)?.lower ?? [];
                return (
                  <div
                    key={stage.id}
                    style={{ gridColumn: index + 1, gridRow: LOWER_ROW }}
                    className="flex flex-col gap-3"
                  >
                    {lower.map((match) => (
                      <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} />
                    ))}
                  </div>
                );
              })}
            </>
          ) : null}

          {finalsColumn && finalsMatch ? (
            <div
              style={{
                gridColumn: regularColumns.length + 1,
                gridRow: hasAnyLowerBracket ? `${UPPER_LABEL_ROW} / span 4` : `${UPPER_ROW} / span 1`,
              }}
            >
              <GrandFinalsCard match={finalsMatch} teamMap={teamMap} accent={accent} />
            </div>
          ) : null}
        </div>
      </BracketConnectors>
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <Breadcrumb
        items={[
          { label: "홈", href: "/" },
          { label: "대회", href: "/tournaments" },
          { label: segmentTheme.name },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-accent">
            {activeSeason} · International
          </span>
          <h1 className="mt-1 text-2xl font-black text-foreground">{segmentTheme.name}</h1>
          <p className="mt-1 text-sm font-medium text-muted">{segmentTheme.description}</p>
        </div>

        <SeasonTabs seasons={seasons} activeSeason={activeSeason} segmentKey={segmentTheme.key} />
      </div>

      {columns.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          아직 공개된 대진표가 없습니다.
        </p>
      ) : (
        <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
          <BracketScroller>
            <BracketGrid columns={columns} teamMap={teamMap} accent={segmentTheme.accent} />
          </BracketScroller>
        </section>
      )}
    </main>
  );
}
