import type { BracketStage, Match, Stage, Team, Tournament } from "@/lib/types";
import { buildTeamStandingRows } from "@/lib/view-data";
import { buildStageColumns, isFinalsStage, isGroupBracketStage, isWeekStage, type StageColumn } from "./bracket";
import { ALL_SEGMENTS, buildSegmentNav } from "./segment-nav";
import { isSupportedSeasonYear, matchesTournamentSegment } from "./season-2026";
import { getLckDefaultView } from "./lck-default-view";
import { deriveCrossGroups, deriveMatchGroups } from "./standings";

type Input = { tournaments: Tournament[]; matches: Match[]; stages: Stage[]; bracketStages: BracketStage[]; teams: Team[] };

export function buildHomeTournamentOverview({ tournaments, matches, stages, bracketStages, teams }: Input, now = new Date()) {
  // Match-bearing sources win over duplicate imports, as on the tournament page.
  const counts = new Map<string, number>();
  for (const match of matches) counts.set(match.tournamentId, (counts.get(match.tournamentId) ?? 0) + 1);
  const sources = new Map<string, Tournament>();
  for (const tournament of tournaments.filter((item) => isSupportedSeasonYear(item.season))) {
    const segment = ALL_SEGMENTS.find((item) => matchesTournamentSegment(tournament, item.key));
    if (!segment) continue;
    const key = `${tournament.season}/${segment.key}/${tournament.split ?? tournament.id}`;
    const current = sources.get(key);
    if (!current || (counts.get(tournament.id) ?? 0) > (counts.get(current.id) ?? 0)) sources.set(key, tournament);
  }
  const candidates = [...sources.values()];
  const ids = new Set(candidates.map((item) => item.id));
  const validMatches = matches.filter((match) => ids.has(match.tournamentId) && Number.isFinite(Date.parse(match.matchDate)));
  const ongoingIds = new Set<string>();
  for (const year of new Set(candidates.map((item) => item.season))) {
    const season = candidates.filter((item) => item.season === year);
    for (const segment of buildSegmentNav(season, validMatches, now).filter((item) => item.isOngoing)) {
      season.filter((item) => matchesTournamentSegment(item, segment.key)).forEach((item) => ongoingIds.add(item.id));
    }
  }
  const newest = (a: Match, b: Match) => Date.parse(b.matchDate) - Date.parse(a.matchDate);
  const nearest = (a: Match, b: Match) => Math.abs(Date.parse(a.matchDate) - now.getTime()) - Math.abs(Date.parse(b.matchDate) - now.getTime());
  const anchor = validMatches.filter((item) => item.status === "live").sort(nearest)[0]
    ?? validMatches.filter((item) => ongoingIds.has(item.tournamentId)).sort(nearest)[0]
    ?? validMatches.filter((item) => item.status === "completed" && Date.parse(item.matchDate) <= now.getTime()).sort(newest)[0]
    ?? validMatches.filter((item) => item.status === "scheduled" && Date.parse(item.matchDate) >= now.getTime()).sort((a, b) => -newest(a, b))[0];
  if (!anchor) return null;
  const tournament = candidates.find((item) => item.id === anchor.tournamentId)!;
  const segment = ALL_SEGMENTS.find((item) => matchesTournamentSegment(tournament, item.key))!;
  const activeTournaments = candidates.filter((item) => item.season === tournament.season && matchesTournamentSegment(item, segment.key));
  const activeIds = new Set(activeTournaments.map((item) => item.id));
  const segmentMatches = validMatches.filter((item) => activeIds.has(item.tournamentId));
  const segmentStages = stages.filter((item) => activeIds.has(item.tournamentId));
  const anchorStage = segmentStages.find((item) => item.id === anchor.stageId);
  const bracket = bracketStages.find((item) => item.id === anchorStage?.bracketStageId);
  const query = new URLSearchParams({ year: String(tournament.season) });
  let selectedMatches = segmentMatches.filter((item) => item.tournamentId === tournament.id);
  let selectedStages = segmentStages.filter((item) => item.tournamentId === tournament.id);
  let standings = Boolean(bracket && isGroupBracketStage(bracket.name, bracket.displayMode));
  let groups: Array<{ title: string; rows: ReturnType<typeof buildTeamStandingRows> }> = [];
  let label = bracket?.name ?? tournament.split ?? "";
  const participatingTeams = (items: Match[]) => teams.filter((team) => items.some((item) => item.teamAId === team.id || item.teamBId === team.id));
  const groupedRows = (colors: Map<string, 0 | 1>, labels: [string, string], items: Match[]) => {
    const genG = teams.find((team) => team.shortName === "GEN" || /gen\.?g/i.test(team.name));
    const first = (genG ? colors.get(genG.id) : undefined) ?? 0;
    return labels.map((title, index) => ({ title, rows: buildTeamStandingRows(teams.filter((team) => colors.get(team.id) === (index === 0 ? first : 1 - first)), items, []) }));
  };
  if (segment.key === "lck") {
    // Anchor the default to the current phase, including today's not-yet-started matches.
    const selection = getLckDefaultView([{ ...anchor, status: "live" }], activeTournaments, segmentStages, bracketStages);
    query.set("split", selection.split);
    query.set("view", selection.view);
    query.set("phase", selection.phase);
    standings = selection.view === "standings";
    if (standings && selection.split === "1") {
      selectedStages = selectedStages.filter((stage) => isWeekStage(stage.name));
      selectedMatches = selectedMatches.filter((match) => selectedStages.some((stage) => stage.id === match.stageId));
      const colors = deriveCrossGroups(selectedMatches);
      if (colors) groups = groupedRows(colors, ["바론 그룹", "장로 그룹"], selectedMatches);
      label = "그룹 배틀";
    } else if (standings) {
      const regularIds = new Set(activeTournaments.filter((item) => item.split === "Rounds 1-2" || (selection.split === "3" && /^Rounds 3-\d+$/.test(item.split ?? ""))).map((item) => item.id));
      selectedMatches = segmentMatches.filter((item) => regularIds.has(item.tournamentId));
      const colors = selection.split === "3" ? deriveMatchGroups(segmentMatches.filter((item) => item.tournamentId === tournament.id)) : null;
      groups = colors ? groupedRows(colors, ["레전드 그룹", "라이즈 그룹"], selectedMatches)
        : [{ title: "정규 시즌", rows: buildTeamStandingRows(teams.filter((team) => team.isLckTeam), selectedMatches, []) }];
      label = "정규 시즌";
    } else if (bracket) {
      selectedStages = selectedStages.filter((stage) => stage.bracketStageId === bracket.id);
    }
  } else if (bracket) {
    query.set("bracketStage", bracket.id);
    query.set("view", standings ? "standings" : "bracket");
    selectedStages = selectedStages.filter((stage) => stage.bracketStageId === bracket.id);
    selectedMatches = selectedMatches.filter((match) => selectedStages.some((stage) => stage.id === match.stageId));
  }
  if (!standings) selectedMatches = selectedMatches.filter((match) => selectedStages.some((stage) => stage.id === match.stageId));
  if (standings && groups.length === 0) {
    const groupIndexes = [...new Set(selectedMatches.map((item) => item.groupIndex))].sort((a, b) => a - b);
    groups = groupIndexes.map((index) => {
      const groupMatches = selectedMatches.filter((item) => item.groupIndex === index);
      return { title: groupIndexes.length > 1 ? `${String.fromCharCode(65 + index)}조` : label, rows: buildTeamStandingRows(participatingTeams(groupMatches), groupMatches, []) };
    });
  }
  return {
    name: `${tournament.season} ${segment.name}`, label,
    href: `/tournaments/${segment.key}?${query}`,
    status: selectedMatches.every((item) => item.status === "completed") ? "종료" : ongoingIds.has(tournament.id) ? "진행 중" : "예정",
    groups, columns: standings ? [] : buildStageColumns(selectedStages, selectedMatches),
  };
}

export type HomeTournamentOverview = ReturnType<typeof buildHomeTournamentOverview>;

/** Home shows a bounded summary, never the full bracket. */
export function summarizeHomeBracket(columns: StageColumn[]) {
  const entries = columns.flatMap(({ stage, matches }) => matches.map((match) => ({ stage, match })));
  const ascending = (a: typeof entries[number], b: typeof entries[number]) => Date.parse(a.match.matchDate) - Date.parse(b.match.matchDate);
  const completed = entries.filter(({ match }) => match.status === "completed").sort((a, b) => -ascending(a, b));
  const pending = entries.filter(({ match }) => match.status !== "completed")
    .sort((a, b) => Number(b.match.status === "live") - Number(a.match.status === "live") || ascending(a, b));
  const final = pending.length === 0 ? completed.find(({ stage }) => isFinalsStage(stage.name)) : undefined;
  if (final) return { final, panels: [] };
  const hasLower = entries.some(({ match }) => match.bracketSide === "lower");
  if (hasLower) {
    const selectSide = (side: "upper" | "lower") => {
      const belongs = ({ match, stage }: typeof entries[number]) => !isFinalsStage(stage.name)
        && (side === "lower" ? match.bracketSide === "lower" : match.bracketSide !== "lower");
      const next = pending.filter(belongs).slice(0, 2);
      return [...completed.filter(belongs).slice(0, 3 - next.length), ...next];
    };
    // A scheduled grand final is more useful than retaining an extra old upper-bracket result.
    const upper = selectSide("upper");
    const nextFinal = pending.find(({ stage }) => isFinalsStage(stage.name));
    if (nextFinal) upper.splice(2, 1, nextFinal);
    return { final: undefined, panels: [{ title: "승자조", entries: upper }, { title: "패자조", entries: selectSide("lower") }] };
  }
  return { final: undefined, panels: [
    { title: "최근 결과", entries: completed.slice(0, 3) },
    { title: pending.some(({ match }) => match.status === "live") ? "진행 중 / 다음 경기" : "다음 경기", entries: pending.slice(0, 3) },
  ] };
}
