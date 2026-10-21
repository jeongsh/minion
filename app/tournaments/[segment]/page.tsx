import { SWISS_GROUP_POSITIONS, SWISS_RESULT_POSITIONS } from "@/packages/contracts/src/tournament-bracket-layout";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { SlidersHorizontal } from "lucide-react";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { RailAdContent } from "@/components/ads/rail-ad-content";

import { EventFilterBar } from "@/components/ui/event-filter-bar";
import { DataTable } from "@/components/ui/data-table";
import { TeamLogo } from "@/components/ui/team-logo";
import { getAllPlayers, getAllTeams, getBracketStages, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import {
  buildStageColumns,
  formatBracketColumnLabel,
  groupLetterLabel,
  isFinalsStage,
  isGroupBracketStage,
  isWeekStage,
  splitBracketSidesForDisplay,
  type StageColumn,
} from "@/lib/tournaments/bracket";
import { segmentThemeByKey } from "@/lib/tournaments/international-segments";
import { buildSegmentNav } from "@/lib/tournaments/segment-nav";
import { getLckDefaultView } from "@/lib/tournaments/lck-default-view";
import { isSupportedSeasonYear, matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import {
  buildPomRankingRows,
  deriveCrossGroups,
  deriveMatchGroups,
  LCK_SPLIT_LABELS,
  LCK_SPLIT_VIEW_LABELS,
  selectLckPomPointMatches,
  type LckSplitKey,
  type PomRow,
} from "@/lib/tournaments/standings";
import { siteBaseUrl } from "@/lib/site";
import type { Match, Team, Tournament } from "@/lib/types";
import { buildTeamStandingRows, dateKeyKST, matchHref } from "@/lib/view-data";

import { TournamentFilters, type TournamentFilter } from "../tournament-filters";

import { UnderlineNav } from "@/components/ui/tabs";

import { BracketConnectors, type BracketConnection } from "./bracket-connectors";
import { BracketScroller } from "./bracket-scroller";
import { buildSwissRounds, buildWorldsPlayInBracket, completedMatchWinner, formatWorldsStageLabel, groupWorldsStages, seriesFormatLabel, swissRecordLabel, WORLDS_PHASE_LABELS, type WorldsPhase } from "@/lib/tournaments/worlds";

const BRACKET_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatBracketDateTime(value: string) {
  const parts = BRACKET_DATE_TIME_FORMATTER.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
}

function GroupStandingsTable({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof buildTeamStandingRows>;
}) {
  const recordLabel = (row: (typeof rows)[number]) => `${row.matchWins}승 ${row.matchLosses}패`;
  const setDiffLabel = (row: (typeof rows)[number]) => (row.setDiff >= 0 ? `+${row.setDiff}` : `${row.setDiff}`);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-[14px] w-[3px] rounded-full bg-[var(--accent)]" />
        <span className="font-paperozi text-[15px] leading-none text-[var(--ui-ink)]">{title}</span>
      </div>
      <DataTable
        mobileSurface="flat"
        rows={rows}
        compact
        columns={[
          {
            key: "rank",
            label: "순위",
            headerClassName: "w-14",
            cellClassName: "font-medium italic tabular-nums",
            render: (row) => row.rank,
          },
          {
            key: "team",
            label: "팀",
            render: (row) => (
              <Link href={`/teams?team=${encodeURIComponent(row.team.fanSiteHost || row.team.slug)}`} className="flex items-center gap-2 font-medium hover:text-accent">
                {row.team.logoUrl ? (
                  <TeamLogo team={row.team} size="h-7 w-7" plain themeAware />
                ) : null}
                <span className="truncate">{row.team.name}</span>
              </Link>
            ),
          },
          { align: "center",
            key: "setDiff",
            label: "득실차",
            headerClassName: "",
            cellClassName: "tabular-nums",
            render: (row) => setDiffLabel(row),
          },
          { align: "center",
            key: "record",
            label: "전적",
            headerClassName: "",
            cellClassName: "tabular-nums",
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
      mobileDense
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
            <div className="flex items-center gap-2.5 md:gap-3">
              <span className="w-6 shrink-0 text-center text-sm font-medium italic tabular-nums md:w-7 md:text-base">{row.rank}</span>
              <Link
                href={`/teams?team=${encodeURIComponent(row.team.fanSiteHost || row.team.slug)}`}
                className="flex min-w-0 items-center gap-2 font-medium hover:text-accent"
              >
                {row.team.logoUrl ? (
                  <TeamLogo team={row.team} size="h-6 w-6 md:h-7 md:w-7" plain themeAware />
                ) : null}
                <span className="truncate">{row.team.name}</span>
              </Link>
            </div>
          ),
        },
        { align: "center",
          key: "wins",
          label: "승",
          headerClassName: "",
          cellClassName: "font-medium tabular-nums",
          render: (row) => row.matchWins,
        },
        { align: "center",
          key: "losses",
          label: "패",
          headerClassName: "",
          cellClassName: "tabular-nums",
          render: (row) => row.matchLosses,
        },
        { align: "center",
          key: "diff",
          label: "득실차",
          headerClassName: "",
          cellClassName: "tabular-nums",
          render: (row) => row.setDiff,
        },
        { align: "center",
          key: "rate",
          label: "승률",
          headerClassName: "",
          cellClassName: "tabular-nums",
          render: (row) => row.winRate,
        },
      ]}
    />
  );
}

function PomRankingTable({ rows }: { rows: PomRow[] }) {
  return (
    <DataTable
      mobileSurface="flat"
      mobileDense
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
            <div className="flex items-center gap-2 md:gap-3">
              <span className="w-6 shrink-0 text-center text-sm font-medium italic tabular-nums md:w-7 md:text-base">{row.rank}</span>
              <div className="flex min-w-0 items-center gap-2">
                {row.player.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.player.profileImageUrl}
                    alt={row.player.name}
                    className="h-6 w-6 shrink-0 rounded-full object-cover md:h-7 md:w-7"
                  />
                ) : null}
                <div className="flex min-w-0 items-baseline gap-1 md:gap-1.5">
                  <p className="truncate text-[13px] font-medium md:text-sm">{row.player.name}</p>
                  <p className="truncate text-[13px] font-medium text-muted">{row.team?.shortName ?? "-"}</p>
                </div>
              </div>
            </div>
          ),
        },
        { align: "center",
          key: "points",
          label: "포인트",
          headerClassName: "",
          cellClassName: "font-medium tabular-nums",
          render: (row) => row.points,
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
        style={{ backgroundColor: !team || /^(tbd|미정)$/i.test(team.name.trim()) ? "var(--ui-muted)" : accentColor }}
        aria-hidden="true"
      />
      <TeamLogo team={team} size="h-5 w-5" plain themeAware />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          isWinner ? "font-medium text-foreground" : "font-medium text-muted"
        }`}
      >
        {team?.name ?? placeholder ?? "TBD"}
      </span>
      <span
        className={`shrink-0 text-[13px] tabular-nums ${
          isWinner ? "font-medium text-foreground" : "font-medium text-muted"
        }`}
      >
        {score ?? "-"}
      </span>
    </div>
  );
}

function InlineMatchTeams({ match, teamA, teamB, accent }: { match?: Match; teamA?: Team; teamB?: Team; accent: string }) {
  const hasScore = match?.teamAScore !== null && match?.teamAScore !== undefined && match?.teamBScore !== null && match?.teamBScore !== undefined;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0.5 px-2 py-2">
      {[teamA, teamB].map((team, index) => {
        const winner = match?.status === "completed" && match.winnerTeamId === team?.id;
        return <Fragment key={index}>
          {index === 1 ? <span className="text-center text-[13px] font-medium tabular-nums text-foreground">{hasScore ? `${match.teamAScore} : ${match.teamBScore}` : "vs"}</span> : null}
          <span className={`flex min-w-0 items-center gap-0.5 ${index === 1 ? "flex-row-reverse" : ""}`} aria-label={team?.name ?? "미정 팀"}>
            <span className="h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: team ? team.primaryColor ?? accent : "var(--ui-muted)" }} aria-hidden="true" />
            <TeamLogo team={team} size="h-6 w-6" plain themeAware />
            <span className={`min-w-0 truncate text-[14px] font-medium ${match?.status === "completed" && !winner ? "text-muted" : "text-foreground"}`}>{team?.shortName || "미정"}</span>
          </span>
        </Fragment>;
      })}
    </div>
  );
}

function MatchCard({
  match,
  teamMap,
  accent,
  bestOf,
  placeholder,
  showFormat = false,
  grouped = false,
}: {
  match?: Match;
  teamMap: Map<string, Team>;
  accent: string;
  bestOf?: number;
  placeholder?: string;
  showFormat?: boolean;
  grouped?: boolean;
}) {
  const rawTeamA = match ? teamMap.get(match.teamAId) : undefined;
  const rawTeamB = match ? teamMap.get(match.teamBId) : undefined;
  const teamA = showFormat && /^(tbd|미정)$/i.test(rawTeamA?.name ?? "") ? undefined : rawTeamA;
  const teamB = showFormat && /^(tbd|미정)$/i.test(rawTeamB?.name ?? "") ? undefined : rawTeamB;
  const winnerA = match?.status === "completed" && match.winnerTeamId === teamA?.id;
  const winnerB = match?.status === "completed" && match.winnerTeamId === teamB?.id;
  const format = match?.bestOf ?? bestOf;
  const rows = showFormat ? <InlineMatchTeams match={match} teamA={teamA} teamB={teamB} accent={accent} /> : <>
    <TeamRow team={teamA} placeholder={placeholder ?? (showFormat ? "대진 미정" : undefined)} score={match?.teamAScore ?? null} isWinner={winnerA} accentColor={teamA?.primaryColor ?? accent} rowIndex={0} />
    <div className="h-px bg-border" />
    <TeamRow team={teamB} placeholder={placeholder ?? (showFormat ? "대진 미정" : undefined)} score={match?.teamBScore ?? null} isWinner={winnerB} accentColor={teamB?.primaryColor ?? accent} rowIndex={1} />
  </>;
  const cardClassName = grouped ? "block overflow-hidden rounded-md bg-surface transition-colors hover:bg-surface-muted" : "block overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent";

  return (
    <div className="flex flex-col gap-1.5">
      {!grouped ? <div className={showFormat ? "flex items-center justify-between gap-2 px-0.5 text-[13px] font-medium text-muted" : "truncate px-0.5 text-[12px] font-medium text-muted"}>
        <span>{match ? formatBracketDateTime(match.matchDate) : "대진 미정"}</span>
        {showFormat ? <span className="shrink-0 text-foreground">{seriesFormatLabel(format)}</span> : null}
      </div> : null}
      {match ? <Link href={matchHref(match)} data-match-id={match.id} className={cardClassName}>{rows}</Link> : <div className={cardClassName}>{rows}</div>}
    </div>
  );
}

function GrandFinalsCard({
  match,
  teamMap,
  accent,
  showFormat = false,
}: {
  match: Match;
  teamMap: Map<string, Team>;
  accent: string;
  showFormat?: boolean;
}) {
  const rawTeamA = teamMap.get(match.teamAId);
  const rawTeamB = teamMap.get(match.teamBId);
  const teamA = showFormat && /^(tbd|미정)$/i.test(rawTeamA?.name ?? "") ? undefined : rawTeamA;
  const teamB = showFormat && /^(tbd|미정)$/i.test(rawTeamB?.name ?? "") ? undefined : rawTeamB;
  const winnerA = match.status === "completed" && match.winnerTeamId === teamA?.id;
  const winnerB = match.status === "completed" && match.winnerTeamId === teamB?.id;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={showFormat ? "flex items-center justify-between gap-2 px-0.5 text-[13px] font-medium text-muted" : "truncate px-0.5 text-[12px] font-medium text-muted"}>
        <span>{formatBracketDateTime(match.matchDate)}</span>
        {showFormat ? <span className="shrink-0 text-foreground">{seriesFormatLabel(match.bestOf ?? 5)}</span> : null}
      </div>
      <Link
        href={matchHref(match)}
        data-match-id={match.id}
        style={{ borderColor: accent }}
        className="block overflow-hidden rounded-md border-2 bg-surface transition-colors hover:bg-surface-muted"
      >
        {showFormat ? <InlineMatchTeams match={match} teamA={teamA} teamB={teamB} accent={accent} /> : <><TeamRow
          team={teamA}
          placeholder={showFormat ? "대진 미정" : "Upper winner"}
          score={match.teamAScore}
          isWinner={winnerA}
          accentColor={teamA?.primaryColor ?? accent}
          rowIndex={0}
        />
        <div className="h-px bg-border" />
        <TeamRow
          team={teamB}
          placeholder={showFormat ? "대진 미정" : "Lower winner"}
          score={match.teamBScore}
          isWinner={winnerB}
          accentColor={teamB?.primaryColor ?? accent}
          rowIndex={1}
        /></>}
      </Link>
    </div>
  );
}

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
    <UnderlineNav items={items} activeKey={activeTab} ariaLabel="대회 상세 탭" bordered={false} className={className} compact />
  );
}

const UPPER_ROW = 2;

// 롤 이스포츠 브래킷의 라운드 라벨처럼 박스 없이 대문자 텍스트로만 처리한다. 스테이지가
// 많은 브래킷에서 회색 알약 박스가 반복되면 시각적 소음이 커진다.
function ColumnHeader({ label, localize = false }: { label: string; localize?: boolean }) {
  const text = localize ? formatWorldsStageLabel(label) : label;
  return (
    <span className={`inline-block w-fit whitespace-nowrap font-medium text-muted ${/[가-힣]/.test(text) ? "text-[13px]" : "text-[12px] uppercase tracking-[0.08em]"}`}>
      {text}
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

function SwissBracket({ columns, teamMap, accent }: { columns: StageColumn[]; teamMap: Map<string, Team>; accent: string }) {
  const knownTeamIds = new Set([...teamMap.values()].filter((team) => !/^(tbd|미정)$/i.test(team.name.trim())).map((team) => team.id));
  const rounds = buildSwissRounds(columns, knownTeamIds);
  const groups = rounds.flatMap((round) => round.groups.map((group) => ({ ...group, round })));
  const connections: BracketConnection[] = groups.flatMap((group) => [
    { fromMatchId: `swiss-${group.wins}-${group.losses}`, toMatchId: `swiss-${group.wins + 1}-${group.losses}` },
    { fromMatchId: `swiss-${group.wins}-${group.losses}`, toMatchId: `swiss-${group.wins}-${group.losses + 1}` },
  ]);
  const nodeStyle = (position: { column: number; row: number; span: number }) => ({ gridColumn: position.column, gridRow: `${position.row} / span ${position.span}` });
  const roundDates = (matches: Match[]) => {
    const days = [...new Set(matches.map((match) => formatBracketDateTime(match.matchDate).split(" ")[0]))];
    return days.length > 1 ? `${days[0]} ~ ${days[days.length - 1]}` : days[0];
  };
  return (
    <BracketConnectors connections={connections} groupConnections>
      <div className="relative grid w-max min-w-full gap-x-8" data-swiss-bracket style={{ gridTemplateColumns: "repeat(6, calc(12.5rem + 1rem + 2px))", gridTemplateRows: "repeat(48, 15px)", justifyContent: "start" }}>
        {groups.map((group) => {
          const key = `${group.wins}-${group.losses}`;
          const label = group.wins === 2 && group.losses === 2 ? "최종 진출전" : group.wins === 2 ? "진출 결정전" : group.losses === 2 ? "탈락 결정전" : "";
          const pending = group.round.unclassified.length === 0 ? Math.max(0, group.expectedMatches - group.matches.length) : 0;
          return (
            <section key={key} className="flex snap-start flex-col gap-2 self-center" style={nodeStyle(SWISS_GROUP_POSITIONS[key])} aria-label={`${swissRecordLabel(group)} 대진`}>
              <div className="flex items-baseline justify-between gap-2 px-0.5"><h3 className="text-[14px] font-medium text-foreground">{swissRecordLabel(group)}</h3>{label ? <span className="text-[13px] font-medium text-muted">{label}</span> : null}</div>
              <div data-match-id={`swiss-${key}`} data-swiss-group={key} className="overflow-hidden rounded-md border border-border bg-surface">
                <div className="flex flex-col gap-2 bg-[var(--ui-card-bg)] p-2">
                  {group.matches.map((match) => <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} grouped showFormat />)}
                  {Array.from({ length: pending }, (_, index) => <MatchCard key={index} teamMap={teamMap} accent={accent} grouped showFormat placeholder="미정" />)}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[13px] font-medium"><span className="text-foreground">{seriesFormatLabel(group.bestOf)}</span><span className="text-muted">{roundDates(group.round.matches)}</span></div>
              </div>
            </section>
          );
        })}
        {SWISS_RESULT_POSITIONS.map((result) => {
          const key = `${result.wins}-${result.losses}`;
          const source = groups.find((group) => `${group.wins}-${group.losses}` === result.from);
          const qualified = result.wins === 3;
          const ids = source?.matches.flatMap((match) => {
            const winner = completedMatchWinner(match);
            return winner ? [qualified ? winner : match.teamAId === winner ? match.teamBId : match.teamAId] : [];
          }) ?? [];
          return (
            <section key={key} className="flex snap-start flex-col gap-2 self-center" style={nodeStyle(result)} aria-label={`${swissRecordLabel(result)} ${qualified ? "8강 진출" : "탈락"}`}>
              <div className="flex items-baseline justify-between gap-2 px-0.5"><h3 className="text-[14px] font-medium text-foreground">{swissRecordLabel(result)}</h3><span className="text-[13px] font-medium text-muted">{qualified ? "8강 진출" : "탈락"}</span></div>
              <div data-match-id={`swiss-${key}`} data-swiss-result={key} className="flex min-h-12 items-center justify-around gap-2 rounded-md border border-border bg-surface px-2 py-2" style={qualified ? { borderColor: accent } : undefined}>
                {Array.from({ length: result.count }, (_, index) => {
                  const team = ids[index] ? teamMap.get(ids[index]) : undefined;
                  return <span key={index} className="flex min-w-0 items-center gap-1.5" aria-label={team?.name ?? "미정 팀"}><TeamLogo team={team} size="h-5 w-5" plain themeAware /><span className="min-w-0 truncate text-[13px] font-medium text-foreground">{team?.shortName ?? "–"}</span></span>;
                })}
              </div>
            </section>
          );
        })}
        {rounds.some((round) => round.unclassified.length > 0) ? <div className="col-span-6 mt-5 flex flex-wrap gap-4" style={{ gridRow: 49 }}>{rounds.flatMap((round) => round.unclassified).map((match) => <div key={match.id} className="w-[12.5rem]"><MatchCard match={match} teamMap={teamMap} accent={accent} showFormat /></div>)}</div> : null}
      </div>
    </BracketConnectors>
  );
}

function BracketGrid({
  columns: sourceColumns,
  teamMap,
  accent,
  worldsPhase,
}: {
  columns: StageColumn[];
  teamMap: Map<string, Team>;
  accent: string;
  worldsPhase?: WorldsPhase;
}) {
  if (worldsPhase === "swiss") {
    return <SwissBracket columns={sourceColumns} teamMap={teamMap} accent={accent} />;
  }
  const playIn = worldsPhase === "playin" ? buildWorldsPlayInBracket(sourceColumns) : null;
  const columns = playIn?.columns ?? sourceColumns;
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

  const connections: BracketConnection[] = playIn?.connections ?? [];
  for (const column of playIn ? [] : columns) {
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
    <BracketConnectors connections={connections} groupConnections={Boolean(playIn)}>
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
                  localize={Boolean(worldsPhase)}
                  label={
                    playIn?.labels.get(matches[0]?.id) ?? (useGroupLabels
                      ? formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                          group: groupLetterLabel(group.groupIndex),
                        })
                      : group.hasLower
                        ? formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                            prefix: "Upper",
                          })
                        : formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`))
                  }
                />
                <div className="flex flex-col gap-3">
                  {matches.map((match) => (
                    <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} showFormat={Boolean(worldsPhase)} bestOf={worldsPhase ? 5 : undefined} />
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
                      localize={Boolean(worldsPhase)}
                      label={
                        playIn?.labels.get(matches[0]?.id) ?? (useGroupLabels
                          ? formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                              group: groupLetterLabel(group.groupIndex),
                              lower: true,
                            })
                          : formatBracketColumnLabel(regularColumns[columnIndex]?.stage.name ?? `${columnIndex + 1}R`, {
                              prefix: "Lower",
                            }))
                      }
                    />
                    <div className="flex flex-col gap-3">
                      {matches.map((match) => (
                        <MatchCard key={match.id} match={match} teamMap={teamMap} accent={accent} showFormat={Boolean(worldsPhase)} bestOf={worldsPhase ? 5 : undefined} />
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
              <ColumnHeader label={playIn ? "최종 진출전" : "Final"} localize={Boolean(worldsPhase)} />
            </div>
            <div
              data-merge-slot="true"
              style={{
                gridColumn: finalsGridColumn,
                gridRow: `${firstContentRow} / span ${lastRow - firstContentRow + 1}`,
              }}
              className="flex flex-col justify-center"
            >
              <GrandFinalsCard match={finalsMatch} teamMap={teamMap} accent={accent} showFormat={Boolean(worldsPhase)} />
            </div>
          </Fragment>
        ) : null}
      </div>
    </BracketConnectors>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ year?: string }>;
}): Promise<Metadata> {
  const { segment: segmentKey } = await params;
  const segmentTheme = segmentThemeByKey(segmentKey);
  if (!segmentTheme) return { title: "대회를 찾을 수 없습니다 | MINION" };

  const search = await searchParams;
  const tournaments = await getTournaments();
  const segmentTournaments = tournaments.filter((tournament) => matchesTournamentSegment(tournament, segmentTheme.key));
  const seasons = [...new Set(segmentTournaments.map((tournament) => tournament.season).filter(isSupportedSeasonYear))].sort((a, b) => b - a);
  const requestedSeason = search.year ? Number(search.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const title = `${segmentTheme.name}${activeSeason ? ` ${activeSeason}` : ""} 대진표·순위 | MINION`;
  const description = `${segmentTheme.name}${activeSeason ? ` ${activeSeason} 시즌` : ""} 대진표, 순위표, 경기 결과를 확인하세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/tournaments/${segmentKey}` },
    openGraph: { title, description, url: `${siteBaseUrl()}/tournaments/${segmentKey}`, type: "website", images: ["/images/minion-og-20260829.png"] },
  };
}

export default async function TournamentBracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{
    year?: string;
    bracketStage?: string;
    view?: string;
    split?: string;
    phase?: string;
  }>;
}) {
  const { segment: segmentKey } = await params;
  const segmentTheme = segmentThemeByKey(segmentKey);

  if (!segmentTheme) {
    notFound();
  }

  const search = await searchParams;
  // POM 순위표 조회에만 쓴다. 은퇴/이적/벤치(is_active=false, is_lck_player=false)한
  // POM 수상자도 집계에 포함돼야 하므로 현역 로스터(getPlayers)가 아닌 전체 선수를 쓴다.
  const [tournaments, stages, matches, teams, bracketStages, players] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
    getBracketStages(),
    getAllPlayers(),
  ]);

  const segmentTournaments = tournaments.filter((tournament) =>
    matchesTournamentSegment(tournament, segmentTheme.key),
  );

  if (segmentTournaments.length === 0) {
    notFound();
  }

  const seasons = [...new Set(segmentTournaments.map((tournament) => tournament.season).filter(isSupportedSeasonYear))].sort(
    (a, b) => b - a,
  );
  const requestedSeason = search.year ? Number(search.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  // 지원 시즌(2026+) 대회가 하나도 없으면 보여줄 게 없다. year=undefined 로 이어지는
  // 깨진 URL을 만들지 않도록 여기서 끊는다.
  if (activeSeason === undefined) {
    notFound();
  }

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

  const filters: TournamentFilter[] = [
    {
      label: "연도",
      selected: String(activeSeason),
      options: seasons.map((season) => ({ value: String(season), label: String(season), href: `/tournaments/${segmentTheme.key}?year=${season}` })),
    },
    {
      label: "대회",
      selected: segmentTheme.key,
      options: segmentNav.map((item) => ({ value: item.key, label: item.name, href: `/tournaments/${item.key}?year=${activeSeason}`, isOngoing: item.isOngoing })),
    },
  ];

  let contentSection: React.ReactNode;
  let contentTitle = segmentTheme.name;
  let hasAdContent = false;

  if (segmentMatches.length === 0) {
    const registeredDates = activeTournaments.flatMap((tournament) => [tournament.startDate, tournament.endDate])
      .filter((value): value is string => Boolean(value) && Number.isFinite(new Date(value!).getTime()))
      .sort();
    const dateLabel = (value: string) => new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
    }).format(new Date(value));
    contentSection = (
      <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 sm:p-8">
        <h2 className="font-paperozi text-[20px] text-[var(--ui-ink)]">경기 일정 등록 전</h2>
        <p className="mt-3 text-[16px] font-normal leading-7 text-[var(--ui-muted)]">
          MINION에 등록된 {activeSeason}년 {segmentTheme.name} 경기 일정과 결과가 없습니다.
        </p>
        {registeredDates.length > 0 ? (
          <p className="mt-3 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
            등록된 대회 기간: {dateLabel(registeredDates[0])}
            {registeredDates.at(-1) !== registeredDates[0] ? ` ~ ${dateLabel(registeredDates.at(-1)!)}` : ""}
          </p>
        ) : null}
        <Link href="/schedule" className="mt-5 inline-flex min-h-11 items-center text-[14px] font-medium underline underline-offset-4">전체 경기 일정 보기</Link>
      </section>
    );
  } else if (isLck) {
    const requestedSplit = ["1", "2", "3"].includes(search.split ?? "")
      ? (search.split as LckSplitKey)
      : undefined;
    const defaultView = getLckDefaultView(segmentMatches, activeTournaments, segmentStages, bracketStages, requestedSplit);
    const activeSplit = requestedSplit ?? defaultView.split;
    const activeView: "standings" | "bracket" | "pom" =
      search.view === "bracket" ? "bracket" : search.view === "pom" ? "pom" : search.view === "standings" ? "standings" : defaultView.view;
    const viewLabels = LCK_SPLIT_VIEW_LABELS[activeSplit];
    const activePhase: "playin" | "playoffs" = search.phase === "playoffs" ? "playoffs" : search.phase === "playin" ? "playin" : defaultView.phase;

    const lckHref = (query: Record<string, string>) => `/tournaments/${segmentTheme.key}?${new URLSearchParams({ year: String(activeSeason), split: activeSplit, ...query })}`;
    filters.push(
      {
        label: "시즌 구간",
        selected: activeSplit,
        options: (Object.keys(LCK_SPLIT_LABELS) as LckSplitKey[]).map((split) => ({ value: split, label: LCK_SPLIT_LABELS[split], href: lckHref({ split }) })),
      },
      {
        label: "세부 단계",
        selected: activeView === "bracket" ? (activeSplit === "2" ? "bracket" : activePhase) : activeView,
        options: [
          { value: "pom", label: "POM", href: lckHref({ view: "pom" }) },
          { value: "standings", label: activeSplit === "3" ? "그룹 배틀" : viewLabels.standings, href: lckHref({ view: "standings" }) },
          ...(activeSplit === "2"
            ? [{ value: "bracket", label: viewLabels.bracket, href: lckHref({ view: "bracket" }) }]
            : [
              { value: "playin", label: "플레이인", href: lckHref({ view: "bracket", phase: "playin" }) },
              { value: "playoffs", label: "플레이오프", href: lckHref({ view: "bracket", phase: "playoffs" }) },
            ]),
        ],
      },
    );

    const splitTitle = activeSplit === "1" ? LCK_SPLIT_LABELS[activeSplit] : `${segmentTheme.name} ${LCK_SPLIT_LABELS[activeSplit]}`;
    const phaseTitle = activeView === "pom" ? "POM 순위" : activeView === "standings" ? `${activeSplit === "3" ? "그룹 배틀" : viewLabels.standings} 순위표` : `${activeSplit === "2" ? viewLabels.bracket : activePhase === "playin" ? "플레이인" : "플레이오프"} 대진표`;
    contentTitle = `${splitTitle} ${phaseTitle}`;

    const bracketOrEmpty = (columns: StageColumn[]) =>
      columns.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          아직 공개된 일정이 없습니다.
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 md:p-6">
          <BracketScroller>
            <BracketGrid columns={columns} teamMap={teamMap} accent="var(--accent)" />
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

    let split1Standings: React.ReactNode = (
      <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
        아직 등록된 순위가 없습니다.
      </p>
    );
    if (cupWeekStages.length > 0) {
      const groupColors = deriveCrossGroups(cupWeekMatches);
      if (groupColors) {
        // 색칠 결과의 0/1은 임의 순서다. 2026 LCK 컵 공식 편성에서 Gen.G가 속한 쪽이
        // 바론 그룹이므로 이를 기준으로 바론/장로 그룹을 고정한다.
        const genG = teams.find((team) => team.shortName === "GEN" || /gen\.?g/i.test(team.name));
        const baronColor: 0 | 1 = (genG ? groupColors.get(genG.id) : undefined) ?? 0;
        const elderColor: 0 | 1 = baronColor === 0 ? 1 : 0;
        const groupATeams = teams.filter((team) => groupColors.get(team.id) === baronColor);
        const groupBTeams = teams.filter((team) => groupColors.get(team.id) === elderColor);

        split1Standings = (
          <div className="grid gap-4 sm:grid-cols-2">
            <GroupStandingsTable title="바론 그룹" rows={buildTeamStandingRows(groupATeams, cupWeekMatches, [])} />
            <GroupStandingsTable title="장로 그룹" rows={buildTeamStandingRows(groupBTeams, cupWeekMatches, [])} />
          </div>
        );
      }
    }

    // 스플릿 2: Rounds 1-2 정규시즌 순위 + Road to MSI 토너먼트.
    const rounds12Matches = segmentMatches.filter((match) =>
      activeTournaments.some((tournament) => tournament.id === match.tournamentId && tournament.split === "Rounds 1-2"),
    );
    const lckTeams = teams.filter((team) => team.isLckTeam);
    const split2Standings = (
      <GroupStandingsTable title="정규 시즌" rows={buildTeamStandingRows(lckTeams, rounds12Matches, [])} />
    );

    const roadToMsiTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Road to MSI").map((tournament) => tournament.id),
    );

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
          <GroupStandingsTable title="레전드 그룹" rows={buildTeamStandingRows(legendTeams, regularSeasonMatches, [])} />
          <GroupStandingsTable title="라이즈 그룹" rows={buildTeamStandingRows(riseTeams, regularSeasonMatches, [])} />
        </div>
      );
    }

    const playInTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Season Play-In").map((tournament) => tournament.id),
    );
    const playoffsTournamentIds = new Set(
      activeTournaments.filter((tournament) => tournament.split === "Season Playoffs").map((tournament) => tournament.id),
    );

    // 실제로 렌더할 스플릿·뷰의 콘텐츠만 만든다. 나머지 스플릿·뷰의 표/대진표는 계산하지 않는다.
    // (순위표 3종 split{1,2,3}Standings 는 위에서 이미 만들었고, 여기선 활성 스플릿 것만 고른다.)
    const activeStandingsContent =
      activeSplit === "1" ? split1Standings : activeSplit === "2" ? split2Standings : split3Standings;

    // POM 포인트는 라운드별로 나누지 않는 정규시즌 누적 기록이다.
    // 1-2·3-4라운드 화면 모두 1-4라운드를 합산하되 플레이-인·플레이오프·Road to MSI는 제외한다.
    const activePomRows =
      activeView === "pom"
        ? buildPomRankingRows(
            selectLckPomPointMatches(activeSplit, {
              cupRegularMatches: cupWeekMatches,
              rounds12Matches,
              rounds34Matches,
            }),
            players,
            teamMap,
          )
        : [];

    let activeBracketContent: React.ReactNode = null;
    if (activeView === "bracket") {
      const bracketColumns =
        activeSplit === "1"
          ? buildStageColumns(
              cupOtherStages.filter(
                (stage) => stage.bracketStageId === (activePhase === "playoffs" ? cupPlayoffBracketStage : cupPlayInBracketStage)?.id,
              ),
              segmentMatches,
            )
          : activeSplit === "2"
            ? buildStageColumns(
                segmentStages.filter((stage) => roadToMsiTournamentIds.has(stage.tournamentId)),
                segmentMatches,
              )
            : buildStageColumns(
                segmentStages.filter((stage) =>
                  (activePhase === "playoffs" ? playoffsTournamentIds : playInTournamentIds).has(stage.tournamentId),
                ),
                segmentMatches,
              );
      activeBracketContent = bracketOrEmpty(bracketColumns);
      hasAdContent = bracketColumns.some((column) => column.matches.length > 0);
    }
    if (activeView === "pom") hasAdContent = activePomRows.length > 0;
    if (activeView === "standings") {
      hasAdContent = (activeSplit === "1" ? cupWeekMatches : activeSplit === "2" ? rounds12Matches : regularSeasonMatches).length > 0;
    }

    contentSection = (
      <section className="flex flex-col gap-6">
        <h2 className="home-section-title text-xl text-[var(--ui-ink)]">{contentTitle}</h2>
        <div className="hidden lg:block"><UnderlineNav ariaLabel="대회 상세 탭" activeKey={activeView === "bracket" && activeSplit !== "2" ? activePhase : activeView} bordered={false} compact items={filters.at(-1)!.options.map(option => ({ key: option.value, label: option.label, href: option.href }))} /></div>
        {activeView === "pom" ? (
          <PomRankingTable rows={activePomRows} />
        ) : activeView === "standings" ? (
          activeStandingsContent
        ) : (
          activeBracketContent
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
    const worldsPhases = segmentTheme.key === "worlds" ? groupWorldsStages(segmentStages, segmentBracketStages) : null;
    const worldsPhaseKeys = Object.keys(WORLDS_PHASE_LABELS) as WorldsPhase[];
    const phaseMatches = (phase: WorldsPhase) => {
      const ids = new Set(worldsPhases?.[phase].map((stage) => stage.id));
      return segmentMatches.filter((match) => ids.has(match.stageId));
    };
    const worldsPhase = worldsPhases
      ? worldsPhaseKeys.find((phase) => phase === search.bracketStage || phase === search.phase)
        ?? worldsPhaseKeys.find((phase) => worldsPhases[phase].some((stage) => stage.bracketStageId === search.bracketStage))
        ?? worldsPhaseKeys.find((phase) => phaseMatches(phase).some((match) => match.status !== "completed"))
        ?? worldsPhaseKeys.findLast((phase) => phaseMatches(phase).length > 0)
        ?? "swiss"
      : undefined;
    const activeStages = worldsPhase && worldsPhases ? worldsPhases[worldsPhase]
      : activeBracketStage ? segmentStages.filter((stage) => stage.bracketStageId === activeBracketStage.id) : segmentStages;
    const columns = buildStageColumns(activeStages, segmentMatches);

    const stageOptions = worldsPhase
      ? worldsPhaseKeys.map((phase) => ({ value: phase, label: WORLDS_PHASE_LABELS[phase], href: `/tournaments/${segmentTheme.key}?year=${activeSeason}&bracketStage=${phase}` }))
      : segmentBracketStages.map((stage) => ({ value: stage.id, label: stage.name, href: `/tournaments/${segmentTheme.key}?year=${activeSeason}&bracketStage=${stage.id}` }));
    if (stageOptions.length > 0) filters.push({ label: "세부 단계", selected: worldsPhase ?? activeBracketStage?.id ?? "", options: stageOptions });

    // 조별 라운드로빈(예: 케스파컵/퍼스트 스탠드 그룹 스테이지)은 대진표 대신 LCK
    // 정규시즌처럼 승-패 순위표로도 보여줄 수 있다. 이름에 "그룹"이 들어가거나 어드민이
    // 순위표로 지정해둔 스테이지는 두 뷰를 모두 지원하며, 기본값은 순위표다.
    const supportsGroupToggle = Boolean(
      !worldsPhase && activeBracketStage && isGroupBracketStage(activeBracketStage.name, activeBracketStage.displayMode),
    );
    const requestedGroupView: "standings" | "bracket" = search.view === "bracket" ? "bracket" : "standings";
    const isGroupStageBracket = supportsGroupToggle && requestedGroupView === "standings";
    const activeStageName = worldsPhase ? WORLDS_PHASE_LABELS[worldsPhase] : activeBracketStage?.name;
    contentTitle = [segmentTheme.name, activeStageName, isGroupStageBracket ? "순위표" : "대진표"].filter(Boolean).join(" ");
    if (supportsGroupToggle) filters.push({ label: "보기", selected: requestedGroupView, options: [
      { value: "standings", label: "순위표", href: `/tournaments/${segmentTheme.key}?year=${activeSeason}&bracketStage=${activeBracketStage?.id}&view=standings` },
      { value: "bracket", label: "대진표", href: `/tournaments/${segmentTheme.key}?year=${activeSeason}&bracketStage=${activeBracketStage?.id}&view=bracket` },
    ] });
    const activeStageIds = new Set(activeStages.map((stage) => stage.id));
    const groupStageMatches = segmentMatches.filter((match) => activeStageIds.has(match.stageId));
    const groupStageTeams = teams.filter((team) =>
      groupStageMatches.some((match) => match.teamAId === team.id || match.teamBId === team.id),
    );
    hasAdContent = isGroupStageBracket
      ? groupStageMatches.length > 0
      : columns.some((column) => column.matches.length > 0);

    contentSection = (
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">
              {contentTitle}
            </h2>
            {supportsGroupToggle ? <div className="hidden lg:block">
              <ViewTabs
                labels={{ standings: "순위표", bracket: "대진표" }}
                activeTab={requestedGroupView}
                segmentKey={segmentTheme.key}
                activeSeason={activeSeason}
                paramName="view"
                extraParams={activeBracketStage ? { bracketStage: activeBracketStage.id } : undefined}
              />
            </div> : null}
          </div>
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
              <BracketGrid columns={columns} teamMap={teamMap} accent="var(--accent)" worldsPhase={worldsPhase} />
            </BracketScroller>
          </div>
        )}
      </section>
    );
  }

  return (
    <main data-ads-blocked={!hasAdContent ? "true" : undefined}>
      <RailAdContent enabled={hasAdContent} />
      <h1 className="sr-only">{segmentTheme.name} 대회</h1>
      <header data-ad-secondary-header className="mt-2 hidden border-b border-[var(--ui-border)] bg-[var(--page-background)] lg:sticky lg:top-[var(--ui-header-height)] lg:z-30 lg:block">
        <div className="layout-wide py-2.5">
          <EventFilterBar>
            <TournamentFilters filters={filters} />
          </EventFilterBar>
        </div>
      </header>
      <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom)+18px)] right-4 z-40 md:bottom-6 lg:hidden">
        <AdaptiveDialog title="대회 필터" trigger={<SlidersHorizontal size={20} />} triggerAriaLabel="필터 열기" triggerClassName="grid h-12 w-12 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-[0_12px_34px_rgba(15,23,42,0.22)] transition-opacity hover:opacity-90">
          <TournamentFilters filters={filters} layout="sheet" />
        </AdaptiveDialog>
      </div>
      <div className="layout-wide mt-6">{contentSection}</div>
    </main>
  );
}
