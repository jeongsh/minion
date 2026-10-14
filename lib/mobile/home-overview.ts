import { buildHomeTournamentOverview, summarizeHomeBracket } from "@/lib/tournaments/home-overview";
import { formatBracketColumnLabel } from "@/lib/tournaments/bracket";
import { toMobileMatch, toMobileTeam } from "@/lib/mobile/api-response";
import type { MobileHomeTournamentOverview } from "@/packages/contracts/src/mobile-v1";

export function mobileHomeOverview(input: Parameters<typeof buildHomeTournamentOverview>[0]): MobileHomeTournamentOverview | null {
  const overview = buildHomeTournamentOverview(input);
  if (!overview) return null;
  const teams = new Map(input.teams.map((team) => [team.id, team]));
  const tournaments = new Map(input.tournaments.map((tournament) => [tournament.id, tournament]));
  const summary = summarizeHomeBracket(overview.columns);
  const entry = ({ stage, match }: NonNullable<typeof summary.final>) => ({ stage: formatBracketColumnLabel(stage.name), match: toMobileMatch(match, teams, tournaments) });
  const groups = overview.groups.length === 1
    ? [0, 1].map((column) => ({ ...overview.groups[0], title: "", rows: overview.groups[0].rows.slice(column * 5, (column + 1) * 5) })).filter((group) => group.rows.length)
    : overview.groups.slice(0, 2).map((group) => ({ ...group, rows: group.rows.slice(0, 5) }));
  const champion = teams.get(summary.final?.match.winnerTeamId ?? "");
  return {
    name: overview.name, href: overview.href,
    groups: groups.map((group) => ({ title: group.title, rows: group.rows.map((row) => ({ team: toMobileTeam(row.team), rank: row.rank, wins: row.matchWins, losses: row.matchLosses, setDiff: row.setDiff })) })),
    final: summary.final ? entry(summary.final) : null,
    champion: champion ? toMobileTeam(champion) : null,
    panels: summary.panels.map((panel) => ({ title: panel.title, entries: panel.entries.map(entry) })),
    hasBracket: overview.columns.length > 0,
  };
}
