import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/ui/data-table";
import { getAllTeams, getBracketStages, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import {
  buildStageColumns,
  isWeekStage,
  splitBracketSidesForDisplay,
  type StageColumn,
} from "@/lib/tournaments/bracket";
import { segmentThemeByKey } from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Match, Team, Tournament } from "@/lib/types";
import {
  buildTeamStandingRows,
  formatDateRange,
  matchHref,
  tournamentStatus,
  type TournamentStatus,
} from "@/lib/view-data";

import { BracketConnectors, type BracketConnection } from "./bracket-connectors";
import { BracketScroller } from "./bracket-scroller";

function isFinalsStage(stageName: string) {
  return stageName.trim().toLowerCase() === "finals";
}

/**
 * LCK컵의 "Week" 스테이지는 개별 브래킷이 아니라 10팀을 두 조로 나눠 서로 다른 조끼리만
 * 붙는 크로스 그룹 스테이지다. 명시적인 조 데이터가 없어서, 매치 상대 관계로부터 이분
 * 그래프 2색칠을 통해 조를 복원한다(깔끔히 두 그룹으로 안 나뉘면 null을 반환해 표시를
 * 건너뛴다).
 */
function deriveCrossGroups(matches: Match[]): Map<string, 0 | 1> | null {
  const opponents = new Map<string, Set<string>>();
  const teamIds = new Set<string>();

  for (const match of matches) {
    teamIds.add(match.teamAId);
    teamIds.add(match.teamBId);
    if (!opponents.has(match.teamAId)) opponents.set(match.teamAId, new Set());
    if (!opponents.has(match.teamBId)) opponents.set(match.teamBId, new Set());
    opponents.get(match.teamAId)!.add(match.teamBId);
    opponents.get(match.teamBId)!.add(match.teamAId);
  }

  const color = new Map<string, 0 | 1>();

  for (const teamId of teamIds) {
    if (color.has(teamId)) continue;

    color.set(teamId, 0);
    const queue = [teamId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentColor = color.get(current)!;
      const nextColor: 0 | 1 = currentColor === 0 ? 1 : 0;

      for (const opponent of opponents.get(current) ?? []) {
        if (!color.has(opponent)) {
          color.set(opponent, nextColor);
          queue.push(opponent);
        } else if (color.get(opponent) !== nextColor) {
          return null;
        }
      }
    }
  }

  return color;
}

/**
 * 일부 시즌의 정규시즌 후반(예: 2025 Rounds 3-5)은 크로스 그룹이 아니라 같은 조끼리만
 * 맞붙는 방식으로 진행된다. 이 경우 매치 상대 관계 그래프는 조별로 서로 연결되지 않은
 * 컴포넌트 2개로 쪼개진다. 정확히 2개로 나뉘지 않으면(조 구분이 없거나 다른 형식이면)
 * null을 반환해 표시를 건너뛴다.
 */
function deriveMatchGroups(matches: Match[]): Map<string, 0 | 1> | null {
  const adjacency = new Map<string, Set<string>>();
  const teamIds = new Set<string>();

  for (const match of matches) {
    teamIds.add(match.teamAId);
    teamIds.add(match.teamBId);
    if (!adjacency.has(match.teamAId)) adjacency.set(match.teamAId, new Set());
    if (!adjacency.has(match.teamBId)) adjacency.set(match.teamBId, new Set());
    adjacency.get(match.teamAId)!.add(match.teamBId);
    adjacency.get(match.teamBId)!.add(match.teamAId);
  }

  const componentOf = new Map<string, number>();
  let componentCount = 0;

  for (const teamId of teamIds) {
    if (componentOf.has(teamId)) continue;

    componentOf.set(teamId, componentCount);
    const queue = [teamId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!componentOf.has(neighbor)) {
          componentOf.set(neighbor, componentCount);
          queue.push(neighbor);
        }
      }
    }

    componentCount += 1;
  }

  if (componentCount !== 2) return null;

  const color = new Map<string, 0 | 1>();
  for (const [teamId, component] of componentOf) {
    color.set(teamId, component === 0 ? 0 : 1);
  }
  return color;
}

function GroupStandingsTable({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof buildTeamStandingRows>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="inline-block w-fit rounded-md bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted">
        {title}
      </span>
      <DataTable
        rows={rows}
        compact
        columns={[
          {
            key: "rank",
            label: "순위",
            headerClassName: "w-14",
            cellClassName: "font-black italic tabular-nums",
            render: (row) => row.rank,
          },
          {
            key: "team",
            label: "팀",
            render: (row) => (
              <Link href={`/teams/${row.team.slug}`} className="flex items-center gap-2 font-semibold hover:text-accent">
                {row.team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.team.logoUrl} alt="" className="h-6 w-8 shrink-0 object-contain" />
                ) : null}
                <span className="truncate">{row.team.name}</span>
              </Link>
            ),
          },
          {
            key: "record",
            label: "전적",
            headerClassName: "text-center",
            cellClassName: "text-center tabular-nums",
            render: (row) => `${row.matchWins}승 · ${row.matchLosses}패`,
          },
        ]}
      />
    </div>
  );
}

function RegularStandingsTable({ rows }: { rows: ReturnType<typeof buildTeamStandingRows> }) {
  return (
    <DataTable
      rows={rows}
      emptyText="아직 등록된 경기가 없습니다."
      columns={[
        {
          key: "team",
          label: "팀 순위",
          headerClassName: "min-w-[18rem]",
          cellClassName: "min-w-[18rem]",
          render: (row) => (
            <div className="flex items-center gap-4">
              <span className="w-9 shrink-0 text-center text-2xl font-black italic tabular-nums">{row.rank}</span>
              <Link
                href={`/teams/${row.team.slug}`}
                className="flex min-w-0 items-center gap-3 font-semibold hover:text-accent"
              >
                {row.team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.team.logoUrl}
                    alt={`${row.team.name} 로고`}
                    className="h-9 w-11 shrink-0 object-contain"
                  />
                ) : null}
                <span className="truncate">{row.team.name}</span>
              </Link>
            </div>
          ),
        },
        {
          key: "wins",
          label: "승",
          headerClassName: "text-center",
          cellClassName: "text-center font-bold tabular-nums",
          render: (row) => row.matchWins,
        },
        {
          key: "losses",
          label: "패",
          headerClassName: "text-center",
          cellClassName: "text-center tabular-nums",
          render: (row) => row.matchLosses,
        },
        {
          key: "diff",
          label: "득실차",
          headerClassName: "text-center",
          cellClassName: "text-center tabular-nums",
          render: (row) => row.setDiff,
        },
        {
          key: "rate",
          label: "승률",
          headerClassName: "text-center",
          cellClassName: "text-center tabular-nums",
          render: (row) => row.winRate,
        },
      ]}
    />
  );
}

function TeamRow({
  team,
  placeholder,
  score,
  isWinner,
  accentColor,
  rowIndex,
}: {
  team: Team | undefined;
  placeholder?: string;
  score: number | null;
  isWinner: boolean;
  accentColor: string;
  rowIndex: 0 | 1;
}) {
  return (
    <div data-team-row={rowIndex} className="flex items-center gap-2 px-2.5 py-1.5">
      <span
        className="h-5 w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />
      {team?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-surface-muted" aria-hidden="true" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          isWinner ? "font-bold text-foreground" : "font-medium text-muted"
        }`}
      >
        {team?.name ?? placeholder ?? "TBD"}
      </span>
      <span
        className={`shrink-0 text-xs tabular-nums ${
          isWinner ? "font-bold text-foreground" : "font-medium text-muted"
        }`}
      >
        {score ?? "-"}
      </span>
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
      className="block overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent"
    >
      <TeamRow
        team={teamA}
        score={match.teamAScore}
        isWinner={winnerA}
        accentColor={teamA?.primaryColor ?? accent}
        rowIndex={0}
      />
      <div className="h-px bg-border" />
      <TeamRow
        team={teamB}
        score={match.teamBScore}
        isWinner={winnerB}
        accentColor={teamB?.primaryColor ?? accent}
        rowIndex={1}
      />
    </Link>
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
      className="block overflow-hidden rounded-md border-2 bg-surface transition-colors hover:bg-surface-muted"
    >
      <TeamRow
        team={teamA}
        placeholder="승자조 승자"
        score={match.teamAScore}
        isWinner={winnerA}
        accentColor={teamA?.primaryColor ?? accent}
        rowIndex={0}
      />
      <div className="h-px bg-border" />
      <TeamRow
        team={teamB}
        placeholder="패자조 승자"
        score={match.teamBScore}
        isWinner={winnerB}
        accentColor={teamB?.primaryColor ?? accent}
        rowIndex={1}
      />
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
              ? "bg-white text-foreground"
              : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
          }`}
        >
          {season}
        </Link>
      ))}
    </div>
  );
}

function BracketStagePills({
  bracketStages,
  activeBracketStageId,
  segmentKey,
  activeSeason,
}: {
  bracketStages: { id: string; name: string }[];
  activeBracketStageId: string;
  segmentKey: string;
  activeSeason: number;
}) {
  if (bracketStages.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {bracketStages.map((bracketStage) => (
        <Link
          key={bracketStage.id}
          href={`/tournaments/${segmentKey}?year=${activeSeason}&bracketStage=${bracketStage.id}`}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
            bracketStage.id === activeBracketStageId
              ? "bg-accent text-accent-foreground"
              : "bg-surface-muted text-muted hover:text-foreground"
          }`}
        >
          {bracketStage.name}
        </Link>
      ))}
    </div>
  );
}

// LCK는 스플릿 1(LCK컵) / 스플릿 2(MSI로 가는 길) / 스플릿 3(롤드컵으로 가는 길)로 구성된다.
// 각 스플릿은 그 스플릿만의 정규시즌 순위 + 게이트키핑 토너먼트를 함께 보여준다.
const LCK_SPLIT_LABELS = { "1": "스플릿 1", "2": "스플릿 2", "3": "스플릿 3" } as const;
type LckSplitKey = keyof typeof LCK_SPLIT_LABELS;

const LCK_SPLIT_VIEW_LABELS: Record<LckSplitKey, { standings: string; bracket: string }> = {
  "1": { standings: "크로스 그룹 스테이지", bracket: "토너먼트" },
  "2": { standings: "정규리그", bracket: "MSI로 가는 길" },
  "3": { standings: "정규리그", bracket: "토너먼트" },
};

function ViewTabs<T extends string>({
  labels,
  activeTab,
  segmentKey,
  activeSeason,
  paramName = "view",
  extraParams,
}: {
  labels: Record<T, string>;
  activeTab: T;
  segmentKey: string;
  activeSeason: number;
  paramName?: string;
  extraParams?: Record<string, string>;
}) {
  return (
    <div className="flex gap-2">
      {(Object.keys(labels) as T[]).map((tab) => {
        const query = new URLSearchParams({ year: String(activeSeason), ...extraParams, [paramName]: tab });

        return (
          <Link
            key={tab}
            href={`/tournaments/${segmentKey}?${query.toString()}`}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              tab === activeTab
                ? "bg-accent text-accent-foreground"
                : "bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            {labels[tab]}
          </Link>
        );
      })}
    </div>
  );
}

const STATUS_META: Record<TournamentStatus, { label: string; className: string }> = {
  upcoming: { label: "예정", className: "bg-white/15 text-white" },
  ongoing: { label: "진행중", className: "bg-emerald-500 text-white" },
  completed: { label: "종료", className: "bg-white/10 text-white/60" },
};

const UPPER_ROW = 2;

function ColumnHeader({ label }: { label: string }) {
  return (
    <span className="inline-block w-fit rounded-md bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted">
      {label}
    </span>
  );
}

type PositionedGroup = {
  groupIndex: number;
  upperByColumn: Map<number, Match[]>;
  lowerByColumn: Map<number, Match[]>;
  hasLower: boolean;
  upperLabelRow: number;
  upperRow: number;
  lowerLabelRow: number | null;
  lowerRow: number | null;
};

/**
 * 같은 라운드 안에 서로 독립적으로 진행되는 여러 그룹(예: 그룹 A/B, 각자 자체
 * 승자조/패자조를 가짐)이 있을 수 있다. match.groupIndex(기본 0)로 그룹을 나누고,
 * 각 그룹을 세로로 쌓인 독립된 미니 브래킷으로 그린다. 그룹이 하나뿐이면(대부분의
 * 경우) 기존과 동일하게 보인다.
 */
function buildPositionedGroups(regularColumns: StageColumn[]) {
  const groupIndices = [
    ...new Set(regularColumns.flatMap((column) => column.matches.map((match) => match.groupIndex ?? 0))),
  ].sort((a, b) => a - b);

  const groups: PositionedGroup[] = [];
  const gapRows: number[] = [];
  let rowCursor = 1;

  for (const groupIndex of groupIndices) {
    const upperByColumn = new Map<number, Match[]>();
    const lowerByColumn = new Map<number, Match[]>();

    regularColumns.forEach((column, columnIndex) => {
      const groupMatches = column.matches.filter((match) => (match.groupIndex ?? 0) === groupIndex);
      if (groupMatches.length === 0) return;

      const split = splitBracketSidesForDisplay(groupMatches);
      if (split.upper.length > 0) upperByColumn.set(columnIndex, split.upper);
      if (split.lower.length > 0) lowerByColumn.set(columnIndex, split.lower);
    });

    if (upperByColumn.size === 0 && lowerByColumn.size === 0) continue;

    if (groups.length > 0) {
      gapRows.push(rowCursor);
      rowCursor += 1;
    }

    const hasLower = lowerByColumn.size > 0;
    const upperLabelRow = rowCursor;
    const upperRow = rowCursor + 1;
    rowCursor += 2;

    let lowerLabelRow: number | null = null;
    let lowerRow: number | null = null;
    if (hasLower) {
      lowerLabelRow = rowCursor;
      lowerRow = rowCursor + 1;
      rowCursor += 2;
    }

    groups.push({ groupIndex, upperByColumn, lowerByColumn, hasLower, upperLabelRow, upperRow, lowerLabelRow, lowerRow });
  }

  return { groups, gapRows, lastRow: rowCursor - 1 };
}

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
  const finalsMatch = finalsColumn?.matches[0];
  const trackColumnCount = Math.max(regularColumns.length, 1);

  const { groups, gapRows, lastRow } = buildPositionedGroups(regularColumns);
  const useGroupLabels = groups.length > 1;
  const firstContentRow = groups[0]?.upperRow ?? UPPER_ROW;

  const matchById = new Map(columns.flatMap((column) => column.matches).map((match) => [match.id, match]));

  const connections: BracketConnection[] = [];
  for (const column of columns) {
    for (const match of column.matches) {
      if (match.advancesToMatchId) {
        const toMatch = matchById.get(match.advancesToMatchId);
        const fromRow: 0 | 1 | undefined = match.winnerTeamId
          ? match.winnerTeamId === match.teamAId
            ? 0
            : 1
          : undefined;
        const toRow: 0 | 1 | undefined =
          toMatch && match.winnerTeamId
            ? toMatch.teamAId === match.winnerTeamId
              ? 0
              : toMatch.teamBId === match.winnerTeamId
                ? 1
                : undefined
            : undefined;
        connections.push({ fromMatchId: match.id, toMatchId: match.advancesToMatchId, fromRow, toRow });
      }
    }
  }

  return (
    <BracketConnectors connections={connections}>
      <div
        className="grid gap-x-4 gap-y-2"
        style={{
          gridTemplateColumns: `repeat(${trackColumnCount}, 12.5rem)${finalsColumn ? " 13.5rem" : ""}`,
        }}
      >
        {gapRows.map((row) => (
          <div key={`gap-${row}`} style={{ gridColumn: "1 / -1", gridRow: row }} className="h-4" aria-hidden="true" />
        ))}

        {groups.map((group) => (
          <Fragment key={group.groupIndex}>
            {[...group.upperByColumn.keys()].map((columnIndex) => (
              <div
                key={`upper-head-${group.groupIndex}-${columnIndex}`}
                style={{ gridColumn: columnIndex + 1, gridRow: group.upperLabelRow }}
              >
                <ColumnHeader
                  label={
                    useGroupLabels || group.hasLower
                      ? `상위권 대진 - ${columnIndex + 1}라운드`
                      : (regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}라운드`)
                  }
                />
              </div>
            ))}

            {[...group.upperByColumn.entries()].map(([columnIndex, matches]) => (
              <div
                key={`upper-${group.groupIndex}-${columnIndex}`}
                style={{ gridColumn: columnIndex + 1, gridRow: group.upperRow }}
                className="flex snap-start flex-col gap-3"
              >
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} />
                ))}
              </div>
            ))}

            {group.hasLower
              ? [...group.lowerByColumn.keys()].map((columnIndex) => (
                  <div
                    key={`lower-head-${group.groupIndex}-${columnIndex}`}
                    style={{ gridColumn: columnIndex + 1, gridRow: group.lowerLabelRow! }}
                  >
                    <ColumnHeader label={`하위권 대진 - ${columnIndex + 1}라운드`} />
                  </div>
                ))
              : null}

            {group.hasLower
              ? [...group.lowerByColumn.entries()].map(([columnIndex, matches]) => (
                  <div
                    key={`lower-${group.groupIndex}-${columnIndex}`}
                    style={{ gridColumn: columnIndex + 1, gridRow: group.lowerRow! }}
                    className="flex flex-col gap-3"
                  >
                    {matches.map((match) => (
                      <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} />
                    ))}
                  </div>
                ))
              : null}
          </Fragment>
        ))}

        {finalsColumn && finalsMatch ? (
          <div style={{ gridColumn: trackColumnCount + 1, gridRow: 1 }} className="flex flex-col gap-2">
            <ColumnHeader label="결승" />
          </div>
        ) : null}

        {finalsColumn && finalsMatch ? (
          <div
            data-merge-slot="true"
            style={{
              gridColumn: trackColumnCount + 1,
              gridRow: `${firstContentRow} / span ${lastRow - firstContentRow + 1}`,
            }}
            className="flex items-center"
          >
            <GrandFinalsCard match={finalsMatch} teamMap={teamMap} accent={accent} />
          </div>
        ) : null}
      </div>
    </BracketConnectors>
  );
}

export default async function TournamentBracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ year?: string; bracketStage?: string; view?: string; split?: string; phase?: string }>;
}) {
  const { segment: segmentKey } = await params;
  const segmentTheme = segmentThemeByKey(segmentKey);

  if (!segmentTheme) {
    notFound();
  }

  const search = await searchParams;
  const [tournaments, stages, matches, teams, bracketStages] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
    getBracketStages(),
  ]);

  const segmentTournaments = tournaments.filter((tournament) =>
    matchesTournamentSegment(tournament, segmentTheme.key),
  );

  if (segmentTournaments.length === 0) {
    notFound();
  }

  const seasons = [...new Set(segmentTournaments.map((tournament) => tournament.season))].sort(
    (a, b) => b - a,
  );
  const requestedSeason = search.year ? Number(search.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const seasonTournaments = segmentTournaments.filter(
    (tournament) => tournament.season === activeSeason,
  );

  // 같은 대회가 두 소스(gol.gg/Leaguepedia)에서 중복 수집된 경우, 실제 경기가 채워진 쪽만 쓴다.
  const matchCountByTournament = new Map<string, number>();
  for (const match of matches) {
    matchCountByTournament.set(match.tournamentId, (matchCountByTournament.get(match.tournamentId) ?? 0) + 1);
  }
  const bestBySplit = new Map<string, Tournament>();
  for (const tournament of seasonTournaments) {
    const key = tournament.split ?? tournament.id;
    const current = bestBySplit.get(key);
    if (!current || (matchCountByTournament.get(tournament.id) ?? 0) > (matchCountByTournament.get(current.id) ?? 0)) {
      bestBySplit.set(key, tournament);
    }
  }
  const activeTournaments = [...bestBySplit.values()];
  const tournamentIds = new Set(activeTournaments.map((tournament) => tournament.id));

  const segmentStages = stages.filter((stage) => tournamentIds.has(stage.tournamentId));
  const segmentMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const starts = activeTournaments
    .map((tournament) => tournament.startDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const ends = activeTournaments
    .map((tournament) => tournament.endDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const rangeStart = starts[0] ?? null;
  const rangeEnd = ends[ends.length - 1] ?? null;
  const dateRange = formatDateRange(rangeStart, rangeEnd);
  const status = tournamentStatus(rangeStart, rangeEnd);
  const statusMeta = STATUS_META[status];
  const region = activeTournaments[0]?.region ?? "International";

  const isLck = segmentTheme.key === "lck";

  let contentSection: React.ReactNode;

  if (isLck) {
    const activeSplit: LckSplitKey = ["1", "2", "3"].includes(search.split ?? "")
      ? (search.split as LckSplitKey)
      : "1";
    const activeView: "standings" | "bracket" = search.view === "bracket" ? "bracket" : "standings";
    const viewLabels = LCK_SPLIT_VIEW_LABELS[activeSplit];
    const activePhase: "playin" | "playoffs" = search.phase === "playoffs" ? "playoffs" : "playin";

    const bracketOrEmpty = (columns: StageColumn[]) =>
      columns.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          아직 공개된 일정이 없습니다.
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 md:p-6">
          <BracketScroller>
            <BracketGrid columns={columns} teamMap={teamMap} accent={segmentTheme.accent} />
          </BracketScroller>
        </div>
      );

    // 스플릿 1: LCK컵 — Week 스테이지는 크로스 그룹 순위, 나머지(플레이인/플레이오프)는 각각 따로
    // 토너먼트로 보여준다(스플릿 3과 동일한 패턴).
    const cupTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Cup").map((tournament) => tournament.id),
    );
    const cupStages = segmentStages.filter((stage) => cupTournamentIds.has(stage.tournamentId));
    const cupWeekStages = cupStages.filter((stage) => isWeekStage(stage.name));
    const cupOtherStages = cupStages.filter((stage) => !isWeekStage(stage.name));
    const cupWeekMatches = segmentMatches.filter((match) => cupWeekStages.some((stage) => stage.id === match.stageId));

    const cupBracketStages = bracketStages.filter((bracketStage) => cupTournamentIds.has(bracketStage.tournamentId));
    const cupPlayInBracketStage = cupBracketStages.find((bracketStage) => /플레이.?인/.test(bracketStage.name));
    const cupPlayoffBracketStage = cupBracketStages.find((bracketStage) => /플레이오프/.test(bracketStage.name));
    const cupPlayInColumns = buildStageColumns(
      cupOtherStages.filter((stage) => stage.bracketStageId === cupPlayInBracketStage?.id),
      segmentMatches,
    );
    const cupPlayoffColumns = buildStageColumns(
      cupOtherStages.filter((stage) => stage.bracketStageId === cupPlayoffBracketStage?.id),
      segmentMatches,
    );

    let split1Standings: React.ReactNode = (
      <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
        아직 등록된 순위가 없습니다.
      </p>
    );
    if (cupWeekStages.length > 0) {
      const groupColors = deriveCrossGroups(cupWeekMatches);
      if (groupColors) {
        // 색칠 결과의 0/1은 임의 순서라 실제 "알파/오메가" 지정과 무관하다. Gen.G가 속한
        // 쪽을 알파조로 고정해 lolesports 표기와 맞춘다(참고 화면 기준).
        const genG = teams.find((team) => team.shortName === "GEN" || /gen\.?g/i.test(team.name));
        const alphaColor: 0 | 1 = (genG ? groupColors.get(genG.id) : undefined) ?? 0;
        const omegaColor: 0 | 1 = alphaColor === 0 ? 1 : 0;
        const groupATeams = teams.filter((team) => groupColors.get(team.id) === alphaColor);
        const groupBTeams = teams.filter((team) => groupColors.get(team.id) === omegaColor);

        split1Standings = (
          <div className="grid gap-4 sm:grid-cols-2">
            <GroupStandingsTable title="알파조" rows={buildTeamStandingRows(groupATeams, cupWeekMatches, [])} />
            <GroupStandingsTable title="오메가조" rows={buildTeamStandingRows(groupBTeams, cupWeekMatches, [])} />
          </div>
        );
      }
    }

    // 스플릿 2: Rounds 1-2 정규시즌 순위 + Road to MSI 토너먼트.
    const rounds12Matches = segmentMatches.filter((match) =>
      activeTournaments.some((tournament) => tournament.id === match.tournamentId && tournament.split === "Rounds 1-2"),
    );
    const lckTeams = teams.filter((team) => team.isLckTeam);
    const split2Standings = <RegularStandingsTable rows={buildTeamStandingRows(lckTeams, rounds12Matches, [])} />;

    const roadToMsiTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Road to MSI").map((tournament) => tournament.id),
    );
    const roadToMsiStages = segmentStages.filter((stage) => roadToMsiTournamentIds.has(stage.tournamentId));
    const roadToMsiColumns = buildStageColumns(roadToMsiStages, segmentMatches);

    // 스플릿 3: Rounds 3-4(시즌에 따라 "Rounds 3-5"로 불리기도 함) 정규시즌 순위 +
    // 롤드컵으로 가는 길(시즌 플레이인+플레이오프) 토너먼트.
    const rounds34Matches = segmentMatches.filter((match) =>
      activeTournaments.some(
        (tournament) => tournament.id === match.tournamentId && /^Rounds 3-\d+$/.test(tournament.split ?? ""),
      ),
    );

    // "정규리그" 순위는 시즌 누적 기록이라 Rounds 1-2와 Rounds 3-4/5를 합쳐서 계산한다.
    // 조 구분(레전드/라이즈)은 Rounds 3-4/5에서만 명시적으로 드러나므로 조 판별은 그 데이터로만 한다.
    const regularSeasonMatches = [...rounds12Matches, ...rounds34Matches];

    // 일부 시즌(예: 2025)은 이 라운드도 LCK컵처럼 두 그룹으로 나뉘어 진행된다. 매치 데이터가
    // 실제로 두 그룹으로 깔끔하게 갈리면(=서로 다른 그룹끼리는 안 붙는 경우) 그룹별 표로,
    // 아니면(예: 2026처럼 그룹 구분 없이 전원이 맞붙는 경우) 통합 순위표로 보여준다.
    let split3Standings: React.ReactNode = (
      <RegularStandingsTable rows={buildTeamStandingRows(lckTeams, regularSeasonMatches, [])} />
    );
    const rounds34GroupColors = deriveMatchGroups(rounds34Matches);
    if (rounds34GroupColors) {
      const genG = teams.find((team) => team.shortName === "GEN" || /gen\.?g/i.test(team.name));
      const legendColor: 0 | 1 = (genG ? rounds34GroupColors.get(genG.id) : undefined) ?? 0;
      const riseColor: 0 | 1 = legendColor === 0 ? 1 : 0;
      const legendTeams = teams.filter((team) => rounds34GroupColors.get(team.id) === legendColor);
      const riseTeams = teams.filter((team) => rounds34GroupColors.get(team.id) === riseColor);

      split3Standings = (
        <div className="grid gap-4 sm:grid-cols-2">
          <GroupStandingsTable title="레전드조" rows={buildTeamStandingRows(legendTeams, regularSeasonMatches, [])} />
          <GroupStandingsTable title="라이즈조" rows={buildTeamStandingRows(riseTeams, regularSeasonMatches, [])} />
        </div>
      );
    }

    const playInTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Season Play-In").map((tournament) => tournament.id),
    );
    const playInStages = segmentStages.filter((stage) => playInTournamentIds.has(stage.tournamentId));
    const playInColumns = buildStageColumns(playInStages, segmentMatches);

    const playoffsTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Season Playoffs").map((tournament) => tournament.id),
    );
    const playoffsStages = segmentStages.filter((stage) => playoffsTournamentIds.has(stage.tournamentId));
    const playoffsColumns = buildStageColumns(playoffsStages, segmentMatches);

    const split1Bracket = bracketOrEmpty(activePhase === "playoffs" ? cupPlayoffColumns : cupPlayInColumns);
    const split3Bracket = bracketOrEmpty(activePhase === "playoffs" ? playoffsColumns : playInColumns);

    const splitStandingsContent: Record<LckSplitKey, React.ReactNode> = {
      "1": split1Standings,
      "2": split2Standings,
      "3": split3Standings,
    };
    const splitBracketContent: Record<LckSplitKey, React.ReactNode> = {
      "1": split1Bracket,
      "2": bracketOrEmpty(roadToMsiColumns),
      "3": split3Bracket,
    };

    contentSection = (
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-foreground">{LCK_SPLIT_LABELS[activeSplit]}</h2>
          <ViewTabs
            labels={LCK_SPLIT_LABELS}
            activeTab={activeSplit}
            segmentKey={segmentTheme.key}
            activeSeason={activeSeason}
            paramName="split"
            extraParams={{ view: activeView }}
          />
        </div>

        {activeSplit === "1" || activeSplit === "3" ? (
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "standings", label: viewLabels.standings, query: { view: "standings" } },
                { key: "playin", label: "플레이-인", query: { view: "bracket", phase: "playin" } },
                { key: "playoffs", label: "플레이오프", query: { view: "bracket", phase: "playoffs" } },
              ] as const
            ).map((tab) => {
              const isActive =
                tab.key === "standings" ? activeView === "standings" : activeView === "bracket" && activePhase === tab.key;
              const query = new URLSearchParams({ year: String(activeSeason), split: activeSplit, ...tab.query });

              return (
                <Link
                  key={tab.key}
                  href={`/tournaments/${segmentTheme.key}?${query.toString()}`}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                    isActive ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <ViewTabs
            labels={{ standings: viewLabels.standings, bracket: viewLabels.bracket }}
            activeTab={activeView}
            segmentKey={segmentTheme.key}
            activeSeason={activeSeason}
            paramName="view"
            extraParams={{ split: activeSplit }}
          />
        )}

        {activeView === "standings" ? splitStandingsContent[activeSplit] : splitBracketContent[activeSplit]}
      </section>
    );
  } else {
    const segmentBracketStages = bracketStages
      .filter((bracketStage) => tournamentIds.has(bracketStage.tournamentId))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const activeBracketStage =
      segmentBracketStages.find((bracketStage) => bracketStage.id === search.bracketStage) ??
      segmentBracketStages[0] ??
      null;
    const activeStages = activeBracketStage
      ? segmentStages.filter((stage) => stage.bracketStageId === activeBracketStage.id)
      : segmentStages;
    const columns = buildStageColumns(activeStages, segmentMatches);

    contentSection = (
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-foreground">대진표</h2>
          <BracketStagePills
            bracketStages={segmentBracketStages}
            activeBracketStageId={activeBracketStage?.id ?? ""}
            segmentKey={segmentTheme.key}
            activeSeason={activeSeason}
          />
        </div>

        {columns.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
            아직 공개된 대진표가 없습니다.
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-4 md:p-6">
            <BracketScroller>
              <BracketGrid columns={columns} teamMap={teamMap} accent={segmentTheme.accent} />
            </BracketScroller>
          </div>
        )}
      </section>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <Breadcrumb
        items={[
          { label: "홈", href: "/" },
          { label: "대회", href: "/tournaments" },
          { label: segmentTheme.name },
        ]}
      />

      <section
        className={`relative isolate overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-lg md:p-10 ${segmentTheme.gradient}`}
      >
        <span
          className="absolute inset-0 bg-[linear-gradient(115deg,transparent_55%,rgba(255,255,255,0.08)_55%,rgba(255,255,255,0.08)_58%,transparent_58%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                {activeSeason} · {region}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">{segmentTheme.name}</h1>
            <p className="mt-1 text-sm font-medium text-white/70">{segmentTheme.description}</p>
            {dateRange ? (
              <span className="mt-4 inline-block w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                {dateRange}
              </span>
            ) : null}
          </div>

          <SeasonTabs seasons={seasons} activeSeason={activeSeason} segmentKey={segmentTheme.key} />
        </div>
      </section>

      {contentSection}
    </main>
  );
}
