import { toMobileBracketMatch, toMobileTeam } from "@/lib/mobile/api-response";
import type { StageColumn } from "@/lib/tournaments/bracket";
import { buildSwissRounds, completedMatchWinner } from "@/lib/tournaments/worlds";
import type { Team } from "@/lib/types";
import type { MobileSwissBracketData } from "@/packages/contracts/src/mobile-v1";
import { SWISS_RESULT_POSITIONS } from "@/packages/contracts/src/tournament-bracket-layout";

export function buildSwissBracketData(columns: StageColumn[], teams: Map<string, Team>): MobileSwissBracketData {
  const known = new Set([...teams.values()].filter(team => !/^(tbd|미정)$/i.test(team.name.trim())).map(team => team.id));
  const rounds = buildSwissRounds(columns, known);
  const groups = rounds.flatMap(round => round.groups.map(group => ({ ...group, round })));
  const date = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
  return {
    groups: groups.map(group => {
      const days = [...new Set(group.round.matches.map(match => date.formatToParts(new Date(match.matchDate)).filter(part => part.type === "month" || part.type === "day").map(part => part.value).join(".")))];
      return { key: `${group.wins}-${group.losses}`, wins: group.wins, losses: group.losses, bestOf: group.bestOf, dateLabel: days.length > 1 ? `${days[0]} ~ ${days.at(-1)}` : days[0], pending: group.round.unclassified.length === 0 ? Math.max(0, group.expectedMatches - group.matches.length) : 0, matches: group.matches.map(match => toMobileBracketMatch(match, teams)) };
    }),
    results: SWISS_RESULT_POSITIONS.map(result => {
      const source = groups.find(group => `${group.wins}-${group.losses}` === result.from);
      const ids = source?.matches.flatMap(match => {
        const winner = completedMatchWinner(match);
        return winner ? [result.wins === 3 ? winner : match.teamAId === winner ? match.teamBId : match.teamAId] : [];
      }) ?? [];
      return { key: `${result.wins}-${result.losses}`, wins: result.wins, losses: result.losses, teams: Array.from({ length: result.count }, (_, index) => { const team = teams.get(ids[index]); return team ? toMobileTeam(team) : null; }) };
    }),
    unclassified: rounds.flatMap(round => round.unclassified).map(match => toMobileBracketMatch(match, teams)),
  };
}
