import { toMobileBracketMatch } from "@/lib/mobile/api-response";
import { formatBracketColumnLabel, groupLetterLabel, isFinalsStage, splitBracketSidesForDisplay, type StageColumn } from "@/lib/tournaments/bracket";
import type { Team } from "@/lib/types";
import type { MobileBracketConnection, MobileBracketData, MobileBracketGroup } from "@/packages/contracts/src/mobile-v1";

/** 웹 app/tournaments/[segment]/page.tsx의 BracketGrid 데이터 준비 로직을 그대로 포팅해, 모바일이 렌더링만 하도록 서버에서 계산한다. */
export function buildBracketData(columns: StageColumn[], teamMap: Map<string, Team>): MobileBracketData {
  const finalsIndex = columns.findLastIndex((column) => isFinalsStage(column.stage.name));
  const finalsColumn = finalsIndex >= 0 ? columns[finalsIndex] : null;
  const regularColumns = finalsIndex >= 0 ? columns.filter((_, index) => index !== finalsIndex) : columns;
  const finalsMatch = finalsColumn?.matches[0];

  const groupIndices = [...new Set(regularColumns.flatMap((column) => column.matches.map((match) => match.groupIndex ?? 0)))].sort((a, b) => a - b);
  const useGroupLabels = groupIndices.length > 1;

  const groups: MobileBracketGroup[] = [];
  for (const groupIndex of groupIndices) {
    const columnsForGroup: MobileBracketGroup["columns"] = [];

    for (const column of regularColumns) {
      const groupMatches = column.matches.filter((match) => (match.groupIndex ?? 0) === groupIndex);
      if (groupMatches.length === 0) continue;

      const split = splitBracketSidesForDisplay(groupMatches);
      if (split.upper.length === 0 && split.lower.length === 0) continue;

      const hasLower = split.lower.length > 0;
      const label = useGroupLabels
        ? formatBracketColumnLabel(column.stage.name, { group: groupLetterLabel(groupIndex) })
        : hasLower
          ? formatBracketColumnLabel(column.stage.name, { prefix: "Upper" })
          : formatBracketColumnLabel(column.stage.name);
      const lowerLabel = hasLower
        ? useGroupLabels
          ? formatBracketColumnLabel(column.stage.name, { group: groupLetterLabel(groupIndex), lower: true })
          : formatBracketColumnLabel(column.stage.name, { prefix: "Lower" })
        : null;

      columnsForGroup.push({
        label,
        lowerLabel,
        lowerMatches: split.lower.map((match) => toMobileBracketMatch(match, teamMap)),
        matches: split.upper.map((match) => toMobileBracketMatch(match, teamMap)),
      });
    }

    if (columnsForGroup.length > 0) groups.push({ columns: columnsForGroup });
  }

  const finals = finalsMatch ? { label: "Final", match: toMobileBracketMatch(finalsMatch, teamMap) } : null;

  const matchById = new Map(columns.flatMap((column) => column.matches).map((match) => [match.id, match]));
  const connections: MobileBracketConnection[] = [];
  for (const column of columns) {
    for (const match of column.matches) {
      if (!match.advancesToMatchId) continue;
      const toMatch = matchById.get(match.advancesToMatchId);
      const fromRow: 0 | 1 | null = match.winnerTeamId ? (match.winnerTeamId === match.teamAId ? 0 : 1) : null;
      const toRow: 0 | 1 | null =
        toMatch && match.winnerTeamId ? (toMatch.teamAId === match.winnerTeamId ? 0 : toMatch.teamBId === match.winnerTeamId ? 1 : null) : null;
      connections.push({ fromMatchId: match.id, fromRow, toMatchId: match.advancesToMatchId, toRow });
    }
  }

  return { connections, finals, groups };
}
