import type { BracketStage, Match, Stage } from "@/lib/types";
import type { StageColumn } from "@/lib/tournaments/bracket";

export type WorldsPhase = "playin" | "swiss" | "knockout";
export const WORLDS_PHASE_LABELS: Record<WorldsPhase, string> = {
  playin: "플레이인", swiss: "스위스", knockout: "토너먼트",
};

export function swissRoundNumber(name: string): number | null {
  const value = name.match(/(?:round|\br)\s*([1-5])\b/i)?.[1] ?? name.match(/([1-5])\s*라운드/)?.[1];
  return value ? Number(value) : null;
}

export function groupWorldsStages(stages: Stage[], bracketStages: BracketStage[]) {
  const names = new Map(bracketStages.map((stage) => [stage.id, stage.name]));
  const phases: Record<WorldsPhase, Stage[]> = { playin: [], swiss: [], knockout: [] };
  for (const stage of stages) {
    const name = `${stage.name} ${names.get(stage.bracketStageId) ?? ""}`;
    const phase: WorldsPhase = /play[\s-]*in|플레이[\s-]*인/i.test(name)
      ? "playin"
      : /quarter|semi|final|8강|4강|결승/i.test(stage.name) || /knockout|playoffs|토너먼트|플레이오프/i.test(name)
        ? "knockout"
        : /swiss|스위스/i.test(name) || swissRoundNumber(stage.name) !== null
          ? "swiss"
          : "knockout";
    phases[phase].push(stage);
  }
  return phases;
}

export function formatWorldsStageLabel(name: string) {
  return name
    .replace(/\bPI\s*D(\d+)/gi, "$1일차")
    .replace(/\bPI\s*[-:]?\s*/gi, "")
    .replace(/\bBR\s*(\d+)/gi, "$1라운드")
    .replace(/main\s*event\s*[-:]?\s*/gi, "")
    .replace(/play[\s-]*in\s*[-:]?\s*/gi, "")
    .replace(/quarter[\s-]*finals?/gi, "8강")
    .replace(/semi[\s-]*finals?/gi, "4강")
    .replace(/grand\s*finals?|\bfinals?\b/gi, "결승")
    .replace(/\bupper\b/gi, "승자조")
    .replace(/\blower\b/gi, "패자조")
    .replace(/(?:\bround|\br)\s*(\d+)/gi, "$1라운드")
    .replace(/swiss\s*stage/gi, "스위스")
    .replace(/\s+/g, " ").trim();
}

export function seriesFormatLabel(bestOf?: number | null) {
  if (bestOf && bestOf > 0 && bestOf % 2 === 1) return `BO${bestOf}`;
  return "경기 방식 미정";
}

export type SwissRecord = { wins: number; losses: number };
export type SwissGroup = SwissRecord & { expectedMatches: number; bestOf: 1 | 3; matches: Match[] };
const RECORDS: SwissRecord[][] = [
  [{ wins: 0, losses: 0 }],
  [{ wins: 1, losses: 0 }, { wins: 0, losses: 1 }],
  [{ wins: 2, losses: 0 }, { wins: 1, losses: 1 }, { wins: 0, losses: 2 }],
  [{ wins: 2, losses: 1 }, { wins: 1, losses: 2 }],
  [{ wins: 2, losses: 2 }],
];
const MATCH_COUNTS = [[8], [4, 4], [2, 4, 2], [3, 3], [3]];
const recordKey = (record: SwissRecord) => `${record.wins}-${record.losses}`;
export const swissRecordLabel = (record: SwissRecord) => `${record.wins}승 ${record.losses}패`;

export function completedMatchWinner(match: Match) {
  if (match.status !== "completed") return null;
  const winner = match.winnerTeamId ?? (
    match.teamAScore !== null && match.teamBScore !== null && match.teamAScore !== match.teamBScore
      ? match.teamAScore > match.teamBScore ? match.teamAId : match.teamBId
      : null
  );
  return winner === match.teamAId || winner === match.teamBId ? winner : null;
}

export function buildWorldsPlayInBracket(columns: StageColumn[]) {
  const matches = columns.flatMap((column) => column.matches).sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  if (matches.length !== 6 || columns.length === 0) return null;
  const opening = matches.slice(0, 2);
  const winners = new Set(opening.map(completedMatchWinner).filter((id): id is string => id !== null));
  if (winners.size !== 2) return null;
  const losers = new Set(opening.map((match) => winners.has(match.teamAId) ? match.teamBId : match.teamAId));
  const upperFinal = matches.slice(2).find((match) => winners.has(match.teamAId) && winners.has(match.teamBId));
  const lowerFirst = matches.slice(2).find((match) => losers.has(match.teamAId) && losers.has(match.teamBId));
  if (!upperFinal || !lowerFirst) return null;
  const remaining = matches.slice(2).filter((match) => match !== upperFinal && match !== lowerFirst);
  const [lowerFinal, final] = remaining;
  if (!lowerFinal || !final) return null;
  const labels = new Map([
    ...opening.map((match) => [match.id, "승자조 1차전"] as const),
    [upperFinal.id, "승자조 결승"], [lowerFirst.id, "패자조 1차전"],
    [lowerFinal.id, "패자조 결승"], [final.id, "최종 진출전"],
  ]);
  const displayMatch = (match: Match, side: "upper" | "lower") => ({ ...match, bracketSide: side, groupIndex: 0 });
  const stageColumns: StageColumn[] = [
    { stage: { ...columns[0].stage, name: "승자조 1차전" }, matches: opening.map((match) => displayMatch(match, "upper")) },
    { stage: { ...columns[0].stage, name: "승자조 결승" }, matches: [displayMatch(upperFinal, "upper"), displayMatch(lowerFirst, "lower")] },
    { stage: { ...columns[0].stage, name: "패자조 결승" }, matches: [displayMatch(lowerFinal, "lower")] },
    { stage: { ...columns[0].stage, name: "Finals" }, matches: [displayMatch(final, "upper")] },
  ];
  const edge = (from: Match, to: Match, winner: boolean) => {
    const winnerId = completedMatchWinner(from);
    const teamId = winnerId ? winner ? winnerId : winnerId === from.teamAId ? from.teamBId : from.teamAId : null;
    return {
      fromMatchId: from.id, toMatchId: to.id,
      fromRow: teamId ? teamId === from.teamAId ? 0 as const : 1 as const : undefined,
      toRow: teamId === to.teamAId ? 0 as const : teamId === to.teamBId ? 1 as const : undefined,
    };
  };
  return {
    columns: stageColumns, labels,
    connections: [
      ...opening.map((match) => edge(match, upperFinal, true)),
      ...opening.map((match) => edge(match, lowerFirst, false)),
      edge(upperFinal, final, true), edge(upperFinal, lowerFinal, false),
      edge(lowerFirst, lowerFinal, true), edge(lowerFinal, final, true),
    ],
  };
}

export function buildSwissRounds(columns: StageColumn[], knownTeamIds: ReadonlySet<string>) {
  const byRound = new Map<number, Match[]>();
  const unmapped: Match[] = [];
  for (const column of columns) {
    for (const match of column.matches) {
      const round = swissRoundNumber(column.stage.name) ?? swissRoundNumber(match.name);
      if (round === null) unmapped.push(match);
      else byRound.set(round, [...(byRound.get(round) ?? []), match]);
    }
  }
  const records = new Map<string, SwissRecord>();
  return RECORDS.map((roundRecords, index) => {
    const round = index + 1;
    const matches = (byRound.get(round) ?? []).sort((a, b) => a.matchDate.localeCompare(b.matchDate));
    const groups: SwissGroup[] = roundRecords.map((record, groupIndex) => ({
      ...record,
      expectedMatches: MATCH_COUNTS[index][groupIndex],
      bestOf: record.wins === 2 || record.losses === 2 ? 3 : 1,
      matches: [],
    }));
    const unclassified: Match[] = index === 0 ? [...unmapped] : [];
    for (const match of matches) {
      const participants = [match.teamAId, match.teamBId].filter((id) => knownTeamIds.has(id));
      const enteringRecords = participants.map((id) => records.get(id) ?? { wins: 0, losses: 0 });
      const completeRecords = enteringRecords.length > 0 && enteringRecords.every((record) => record.wins + record.losses === index);
      const sameRecord = completeRecords && enteringRecords.every((record) => recordKey(record) === recordKey(enteringRecords[0]));
      const group = sameRecord ? groups.find((item) => recordKey(item) === recordKey(enteringRecords[0])) : null;
      if (group) group.matches.push(match);
      else if (participants.length > 0 || match.status !== "scheduled") unclassified.push(match);
    }
    // Only completed earlier rounds establish the record entering a later round.
    for (const match of matches) {
      if (match.status !== "completed" || !knownTeamIds.has(match.teamAId) || !knownTeamIds.has(match.teamBId)) continue;
      const winner = completedMatchWinner(match);
      if (!winner) continue;
      for (const id of [match.teamAId, match.teamBId]) {
        const previous = records.get(id) ?? { wins: 0, losses: 0 };
        records.set(id, { wins: previous.wins + Number(id === winner), losses: previous.losses + Number(id !== winner) });
      }
    }
    return { round, matches, groups, unclassified };
  });
}
