import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { TeamLogo } from "@/components/ui/team-logo";
import { getAllTeams, getBracketStages, getMatches, getPlayers, getStages, getTournaments } from "@/lib/data/lck";
import {
  buildStageColumns,
  isGroupBracketStage,
  isWeekStage,
  splitBracketSidesForDisplay,
  type StageColumn,
} from "@/lib/tournaments/bracket";
import { segmentThemeByKey } from "@/lib/tournaments/international-segments";
import { buildSegmentNav } from "@/lib/tournaments/segment-nav";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Match, Player, Team, Tournament } from "@/lib/types";
import { buildTeamStandingRows, dateKeyKST, matchHref } from "@/lib/view-data";

import { SegmentSwitcher } from "../segment-switcher";
import { TournamentMark } from "../tournament-mark";
import { SegmentedControl, UnderlineNav } from "@/components/ui/tabs";
import { YearSelect } from "../year-select";
import { BracketConnectors, type BracketConnection } from "./bracket-connectors";
import { BracketScroller } from "./bracket-scroller";

const BRACKET_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const FINALS_STAGE_NAMES = new Set(["finals", "grand finals", "grand final", "결승"]);

function isFinalsStage(stageName: string) {
  return FINALS_STAGE_NAMES.has(stageName.trim().toLowerCase());
}

function formatBracketDateTime(value: string) {
  const parts = BRACKET_DATE_TIME_FORMATTER.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
}

function compactStageName(stageName: string) {
  return stageName
    .replace(/Bracket Round\s*(\d+)/i, "BR$1")
    .replace(/Play-?In Day\s*(\d+)/i, "PI D$1")
    .replace(/PLAY[\s-]?IN/i, "PI")
    .replace(/Round\s*(\d+)/i, "R$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatBracketColumnLabel(stageName: string, opts?: { prefix?: string; group?: string; lower?: boolean }) {
  const tokens = [opts?.group, opts?.prefix, compactStageName(stageName), opts?.lower ? "패자조" : null].filter(
    Boolean,
  );
  return tokens.join(" ");
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
  const recordLabel = (row: (typeof rows)[number]) => `${row.matchWins}승 · ${row.matchLosses}패`;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-[16px] w-[3px] rounded-full bg-[var(--accent)]" />
        <span className="font-paperozi text-[16px] leading-none text-[var(--ui-ink)]">{title}</span>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface md:hidden">
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div
                key={row.team.id}
                className="grid min-h-[58px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 px-3.5 py-3"
              >
                <span className="text-sm font-black italic tabular-nums text-foreground">{row.rank}</span>
                <Link
                  href={`/teams/${row.team.slug}`}
                  className="flex min-w-0 items-center gap-2 font-semibold text-foreground hover:text-accent"
                >
                  {row.team.logoUrl ? (
                    <TeamLogo team={row.team} size="h-7 w-7" plain themeAware />
                  ) : null}
                  <span className="min-w-0 truncate text-sm">{row.team.name}</span>
                </Link>
                <span className="shrink-0 text-right text-[13px] font-black tabular-nums text-foreground">
                  {recordLabel(row)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted md:hidden">
          아직 등록된 순위가 없습니다.
        </div>
      )}
      <DataTable
        mobileSurface="flat"
        className="hidden md:block"
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
                  <TeamLogo team={row.team} size="h-7 w-7" plain themeAware />
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
            render: (row) => recordLabel(row),
          },
        ]}
      />
    </div>
  );
}

function RegularStandingsTable({ rows }: { rows: ReturnType<typeof buildTeamStandingRows> }) {
  return (
    <DataTable
      mobileSurface="flat"
      rows={rows}
      dense
      emptyText="아직 등록된 경기가 없습니다."
      columns={[
        {
          key: "team",
          label: "팀 순위",
          headerClassName: "min-w-[18rem]",
          cellClassName: "min-w-[18rem]",
          render: (row) => (
            <div className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-center text-base font-black italic tabular-nums">{row.rank}</span>
              <Link
                href={`/teams/${row.team.slug}`}
                className="flex min-w-0 items-center gap-2 font-semibold hover:text-accent"
              >
                {row.team.logoUrl ? (
                  <TeamLogo team={row.team} size="h-7 w-7" plain themeAware />
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

type PomRow = { rank: number; player: Player; team?: Team; count: number };

function buildPomRankingRows(segmentMatches: Match[], players: Player[], teamMap: Map<string, Team>): PomRow[] {
  const counts = new Map<string, number>();
  for (const match of segmentMatches) {
    if (!match.officialPomPlayerId) continue;
    counts.set(match.officialPomPlayerId, (counts.get(match.officialPomPlayerId) ?? 0) + 1);
  }

  const unranked: Array<{ player: Player; team?: Team; count: number }> = [];
  for (const [playerId, count] of counts) {
    const player = players.find((item) => item.id === playerId);
    if (player) unranked.push({ player, team: teamMap.get(player.teamId), count });
  }

  return unranked
    .sort((a, b) => b.count - a.count)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function PomRankingTable({ rows }: { rows: PomRow[] }) {
  return (
    <DataTable
      mobileSurface="flat"
      rows={rows}
      dense
      emptyText="아직 선정된 POM이 없습니다."
      getRowHref={(row) => `/players/${row.player.slug}`}
      columns={[
        {
          key: "player",
          label: "선수",
          headerClassName: "min-w-[18rem]",
          cellClassName: "min-w-[18rem]",
          render: (row) => (
            <div className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-center text-base font-black italic tabular-nums">{row.rank}</span>
              <div className="flex min-w-0 items-center gap-2">
                {row.player.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.player.profileImageUrl}
                    alt={row.player.name}
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <p className="truncate font-semibold">{row.player.name}</p>
                  <p className="truncate text-[12px] text-muted">{row.team?.shortName ?? "-"}</p>
                </div>
              </div>
            </div>
          ),
        },
        {
          key: "count",
          label: "POM",
          headerClassName: "text-center",
          cellClassName: "text-center font-bold tabular-nums",
          render: (row) => row.count,
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
        <TeamLogo team={team} size="h-5 w-5" plain themeAware />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-surface-muted" aria-hidden="true" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          isWinner ? "font-bold text-foreground" : "font-medium text-muted"
        }`}
      >
        {team?.name ?? placeholder ?? "TBD"}
      </span>
      <span
        className={`shrink-0 text-[13px] tabular-nums ${
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
    <div className="flex flex-col gap-1.5">
      <div className="truncate px-0.5 text-[12px] font-medium text-muted">{formatBracketDateTime(match.matchDate)}</div>
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
    <div className="flex flex-col gap-1.5">
      <div className="truncate px-0.5 text-[12px] font-medium text-muted">{formatBracketDateTime(match.matchDate)}</div>
      <Link
        href={matchHref(match)}
        data-match-id={match.id}
        style={{ borderColor: accent }}
        className="block overflow-hidden rounded-md border-2 bg-surface transition-colors hover:bg-surface-muted"
      >
        <TeamRow
          team={teamA}
          placeholder="Upper winner"
          score={match.teamAScore}
          isWinner={winnerA}
          accentColor={teamA?.primaryColor ?? accent}
          rowIndex={0}
        />
        <div className="h-px bg-border" />
        <TeamRow
          team={teamB}
          placeholder="Lower winner"
          score={match.teamBScore}
          isWinner={winnerB}
          accentColor={teamB?.primaryColor ?? accent}
          rowIndex={1}
        />
      </Link>
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
  return (
    <SegmentedControl
      ariaLabel="대진표 스테이지 선택"
      activeKey={activeBracketStageId}
      items={bracketStages.map((bracketStage) => ({
        key: bracketStage.id,
        label: bracketStage.name,
        href: `/tournaments/${segmentKey}?year=${activeSeason}&bracketStage=${bracketStage.id}`,
      }))}
    />
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
  className = "",
}: {
  labels: Record<T, string>;
  activeTab: T;
  segmentKey: string;
  activeSeason: number;
  paramName?: string;
  extraParams?: Record<string, string>;
  className?: string;
}) {
  const tabs = Object.keys(labels) as T[];
  const items = tabs.map((tab) => {
    const query = new URLSearchParams({ year: String(activeSeason), ...extraParams, [paramName]: tab });
    return { key: tab, label: labels[tab], href: `/tournaments/${segmentKey}?${query.toString()}` };
  });

  return (
    <UnderlineNav items={items} activeKey={activeTab} ariaLabel="대회 상세 탭" bordered={false} className={className} />
  );
}

const UPPER_ROW = 2;

// 롤 이스포츠 브래킷의 라운드 라벨처럼 박스 없이 대문자 텍스트로만 처리한다. 스테이지가
// 많은 브래킷에서 회색 알약 박스가 반복되면 시각적 소음이 커진다.
function ColumnHeader({ label }: { label: string }) {
  return (
    <span className="inline-block w-fit whitespace-nowrap text-[12px] font-black uppercase tracking-[0.08em] text-muted">
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

function groupLetterLabel(groupIndex: number) {
  return `${String.fromCharCode(65 + groupIndex)}조`;
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
  // "결승"이라는 이름의 최종 진출전이 그랜드 파이널("Finals")과 별개 스테이지로 함께 있는
  // 시즌이 있다(예: 2026 LCK컵 플레이오프). 열은 날짜순이므로 매칭되는 것 중 '마지막'이
  // 진짜 그랜드 파이널이다 — 첫 매칭을 집으면 앞 단계 경기가 오른쪽 끝으로 빠지고 연결선이
  // 거꾸로 그려진다.
  const finalsIndex = columns.findLastIndex((column) => isFinalsStage(column.stage.name));
  const finalsColumn = finalsIndex >= 0 ? columns[finalsIndex] : null;
  const regularColumns = finalsIndex >= 0 ? columns.filter((_, index) => index !== finalsIndex) : columns;
  const finalsMatch = finalsColumn?.matches[0];
  const trackColumnCount = Math.max(regularColumns.length, 1);

  const { groups, gapRows, lastRow } = buildPositionedGroups(regularColumns);
  const useGroupLabels = groups.length > 1;
  const firstContentRow = groups[0]?.upperRow ?? UPPER_ROW;

  const finalsGridColumn = trackColumnCount + 1;

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
        className="grid w-max min-w-full gap-x-4 gap-y-2"
        style={{
          gridTemplateColumns: `repeat(${trackColumnCount + (finalsMatch ? 1 : 0)}, 12.5rem)`,
          justifyContent: "start",
        }}
      >
        {gapRows.map((row) => (
          <div key={`gap-${row}`} style={{ gridColumn: "1 / -1", gridRow: row }} className="h-4" aria-hidden="true" />
        ))}

        {groups.map((group) => (
          <Fragment key={group.groupIndex}>
            {/* 헤더(라벨)와 카드를 한 덩어리로 묶어야, 연결선이 두 소스 사이로 카드를
                띄울 때(BracketConnectors의 merge 로직) 라벨이 같이 따라가서 어긋나지
                않는다. data-merge-slot이 있어야 그 로직이 이 칸을 옮길 수 있다. */}
            {[...group.upperByColumn.entries()].map(([columnIndex, matches]) => (
              <div
                key={`upper-${group.groupIndex}-${columnIndex}`}
                data-merge-slot="true"
                style={{ gridColumn: columnIndex + 1, gridRow: `${group.upperLabelRow} / span 2` }}
                className="flex snap-start flex-col gap-2"
              >
                <ColumnHeader
                  label={
                    useGroupLabels
                      ? formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                          group: groupLetterLabel(group.groupIndex),
                        })
                      : group.hasLower
                        ? formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                            prefix: "Upper",
                          })
                        : formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`)
                  }
                />
                <div className="flex flex-col gap-3">
                  {matches.map((match) => (
                    <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} />
                  ))}
                </div>
              </div>
            ))}

            {group.hasLower
              ? [...group.lowerByColumn.entries()].map(([columnIndex, matches]) => (
                  <div
                    key={`lower-${group.groupIndex}-${columnIndex}`}
                    data-merge-slot="true"
                    data-bracket-side="lower"
                    style={{ gridColumn: columnIndex + 1, gridRow: `${group.lowerLabelRow} / span 2` }}
                    className="flex flex-col gap-2"
                  >
                    <ColumnHeader
                      label={
                        useGroupLabels
                          ? formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                              group: groupLetterLabel(group.groupIndex),
                              lower: true,
                            })
                          : formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                              prefix: "Lower",
                            })
                      }
                    />
                    <div className="flex flex-col gap-3">
                      {matches.map((match) => (
                        <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} />
                      ))}
                    </div>
                  </div>
                ))
              : null}
          </Fragment>
        ))}

        {/* 결승은 나머지 라운드 전체를 세로로 아우르는 마지막 열에 헤더 + 카드로 함께 놓는다. */}
        {finalsMatch ? (
          <Fragment>
            <div style={{ gridColumn: finalsGridColumn, gridRow: 1 }} className="flex flex-col gap-2">
              <ColumnHeader label="Final" />
            </div>
            <div
              data-merge-slot="true"
              style={{
                gridColumn: finalsGridColumn,
                gridRow: `${firstContentRow} / span ${lastRow - firstContentRow + 1}`,
              }}
              className="flex flex-col justify-center"
            >
              <GrandFinalsCard match={finalsMatch} teamMap={teamMap} accent={accent} />
            </div>
          </Fragment>
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
  const [tournaments, stages, matches, teams, bracketStages, players] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
    getBracketStages(),
    getPlayers(),
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

  const isLck = segmentTheme.key === "lck";

  // 대회 목록 페이지 대신 상단 스위처로 전환하므로, 같은 시즌의 모든 대회를 함께 계산한다.
  const segmentNav = buildSegmentNav(
    tournaments.filter((tournament) => tournament.season === activeSeason),
    matches,
  );

  let contentSection: React.ReactNode;

  if (isLck) {
    const activeSplit: LckSplitKey = ["1", "2", "3"].includes(search.split ?? "")
      ? (search.split as LckSplitKey)
      : "1";
    const activeView: "standings" | "bracket" | "pom" =
      search.view === "bracket" ? "bracket" : search.view === "pom" ? "pom" : "standings";
    const pomRows = buildPomRankingRows(segmentMatches, players, teamMap);
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
      <section className="flex flex-col gap-6">
        {/* 상세 탭(1차)과 스플릿(2차)은 데스크탑에서 한 줄을 공유한다 — 탭은 왼쪽 언더라인,
            스플릿은 오른쪽 세그먼티드 컨트롤로 위계를 나눈다. 모바일에서는 가로 폭이 부족해
            스플릿을 위, 탭을 아래로 쌓고 탭이 트랙 보더를 직접 그린다. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:border-b sm:border-[var(--ui-border)]">
          {activeSplit === "1" || activeSplit === "3" ? (
            <UnderlineNav
              ariaLabel="대회 상세 탭"
              bordered={false}
              className="order-2 border-b border-[var(--ui-border)] sm:order-1 sm:-mb-px sm:border-b-0"
              activeKey={activeView === "bracket" ? activePhase : activeView}
              items={(
                [
                  { key: "pom", label: "POM", query: { view: "pom" } },
                  { key: "standings", label: viewLabels.standings, query: { view: "standings" } },
                  { key: "playin", label: "플레이-인", query: { view: "bracket", phase: "playin" } },
                  { key: "playoffs", label: "플레이오프", query: { view: "bracket", phase: "playoffs" } },
                ] as const
              ).map((tab) => ({
                key: tab.key,
                label: tab.label,
                href: `/tournaments/${segmentTheme.key}?${new URLSearchParams({
                  year: String(activeSeason),
                  split: activeSplit,
                  ...tab.query,
                }).toString()}`,
              }))}
            />
          ) : (
            <ViewTabs
              labels={{ pom: "순위", standings: viewLabels.standings, bracket: viewLabels.bracket }}
              activeTab={activeView}
              segmentKey={segmentTheme.key}
              activeSeason={activeSeason}
              paramName="view"
              extraParams={{ split: activeSplit }}
              className="order-2 border-b border-[var(--ui-border)] sm:order-1 sm:-mb-px sm:border-b-0"
            />
          )}

          <SegmentedControl
            ariaLabel="스플릿 선택"
            activeKey={activeSplit}
            className="order-1 sm:order-2 sm:mb-2"
            items={(Object.keys(LCK_SPLIT_LABELS) as LckSplitKey[]).map((split) => ({
              key: split,
              label: LCK_SPLIT_LABELS[split],
              href: `/tournaments/${segmentTheme.key}?${new URLSearchParams({
                year: String(activeSeason),
                split,
                view: activeView,
              }).toString()}`,
            }))}
          />
        </div>

        {activeView === "pom" ? (
          <PomRankingTable rows={pomRows} />
        ) : activeView === "standings" ? (
          splitStandingsContent[activeSplit]
        ) : (
          splitBracketContent[activeSplit]
        )}
      </section>
    );
  } else {
    const segmentBracketStages = bracketStages
      .filter((bracketStage) => tournamentIds.has(bracketStage.tournamentId))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    // URL에 브래킷 스테이지 지정이 없으면, 오늘 날짜에 경기가 있는 스테이지를 기본으로
    // 보여준다(예: 그룹 스테이지는 끝났고 오늘이 8강 날이면 8강을 바로 보여줌 — 그 8강
    // 경기의 시작 시각이 아직 안 지났어도 오늘 날짜라면 우선한다). 오늘 경기가 있는
    // 스테이지가 없으면 아직 다 안 끝난 첫 스테이지로 대체한다. 대회 전체가 이미
    // 완료됐으면 "처음부터" 보여준다는 의도로 첫 스테이지로 되돌아간다.
    const todayKey = dateKeyKST(new Date());
    const bracketStageInfo = segmentBracketStages.map((bracketStage) => {
      const stageIds = new Set(
        segmentStages.filter((stage) => stage.bracketStageId === bracketStage.id).map((stage) => stage.id),
      );
      const stageMatches = segmentMatches.filter((match) => stageIds.has(match.stageId));
      return {
        bracketStage,
        hasToday: stageMatches.some((match) => dateKeyKST(match.matchDate) === todayKey),
        isDone: stageMatches.length > 0 && stageMatches.every((match) => match.status === "completed"),
      };
    });
    const tournamentFullyCompleted = bracketStageInfo.length > 0 && bracketStageInfo.every((info) => info.isDone);
    // 아직 안 끝난 스테이지 중에선 실제 대진표(displayMode="bracket")를 순위표 전용
    // 스테이지(예: 조별리그)보다 우선한다. 그렇지 않으면 조별리그 마지막 라운드가 몇 경기
    // 안 끝났다는 이유만으로, 이미 편성된 토너먼트 스테이지가 있어도 순위표만 계속 보이게 된다.
    const currentBracketStage = tournamentFullyCompleted
      ? null
      : (bracketStageInfo.find((info) => info.hasToday) ??
          bracketStageInfo.find((info) => !info.isDone && info.bracketStage.displayMode !== "standings") ??
          bracketStageInfo.find((info) => !info.isDone))
          ?.bracketStage;
    const activeBracketStage =
      segmentBracketStages.find((bracketStage) => bracketStage.id === search.bracketStage) ??
      currentBracketStage ??
      segmentBracketStages[0] ??
      null;
    const activeStages = activeBracketStage
      ? segmentStages.filter((stage) => stage.bracketStageId === activeBracketStage.id)
      : segmentStages;
    const columns = buildStageColumns(activeStages, segmentMatches);

    // 조별 라운드로빈(예: 케스파컵/퍼스트 스탠드 그룹 스테이지)은 대진표 대신 LCK
    // 정규시즌처럼 승-패 순위표로도 보여줄 수 있다. 이름에 "그룹"이 들어가거나 어드민이
    // 순위표로 지정해둔 스테이지는 두 뷰를 모두 지원하며, 기본값은 순위표다.
    const supportsGroupToggle = Boolean(
      activeBracketStage && isGroupBracketStage(activeBracketStage.name, activeBracketStage.displayMode),
    );
    const requestedGroupView: "standings" | "bracket" = search.view === "bracket" ? "bracket" : "standings";
    const isGroupStageBracket = supportsGroupToggle && requestedGroupView === "standings";
    const activeStageIds = new Set(activeStages.map((stage) => stage.id));
    const groupStageMatches = segmentMatches.filter((match) => activeStageIds.has(match.stageId));
    const groupStageTeams = teams.filter((team) =>
      groupStageMatches.some((match) => match.teamAId === team.id || match.teamBId === team.id),
    );

    contentSection = (
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="home-section-title text-[20px] text-[var(--ui-ink)]">
              {isGroupStageBracket ? "조 순위" : "대진표"}
            </h2>
            {supportsGroupToggle ? (
              <ViewTabs
                labels={{ standings: "순위표", bracket: "대진표" }}
                activeTab={requestedGroupView}
                segmentKey={segmentTheme.key}
                activeSeason={activeSeason}
                paramName="view"
                extraParams={activeBracketStage ? { bracketStage: activeBracketStage.id } : undefined}
              />
            ) : null}
          </div>
          <BracketStagePills
            bracketStages={segmentBracketStages}
            activeBracketStageId={activeBracketStage?.id ?? ""}
            segmentKey={segmentTheme.key}
            activeSeason={activeSeason}
          />
        </div>

        {isGroupStageBracket ? (
          <RegularStandingsTable rows={buildTeamStandingRows(groupStageTeams, groupStageMatches, [])} />
        ) : columns.length === 0 ? (
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
    <main className="layout-wide flex flex-col gap-6 py-6 sm:py-10">
      <PageHeader
        title={segmentTheme.name}
        leading={
          segmentTheme.logo ? (
            <TournamentMark
              logo={segmentTheme.logo}
              aspect={segmentTheme.logoAspect}
              className="h-7 max-w-[62px] text-[var(--ui-ink)] md:h-9 md:max-w-[80px]"
            />
          ) : undefined
        }
        breadcrumbs={[
          { label: "홈", href: "/" },
          { label: "대회", href: "/tournaments" },
          { label: segmentTheme.name },
        ]}
      />

      <div className="flex items-center gap-3">
        <SegmentSwitcher
          items={segmentNav}
          activeKey={segmentTheme.key}
          activeSeason={activeSeason}
          className="min-w-0 flex-1"
        />
        <YearSelect
          seasons={seasons}
          activeSeason={activeSeason}
          segmentKey={segmentTheme.key}
          className="ml-auto"
        />
      </div>

      {contentSection}
    </main>
  );
}
