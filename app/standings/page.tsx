import Link from "next/link";
import { Suspense } from "react";

import { DataTable } from "@/components/ui/data-table";
import { buildChampionRankings, type ChampionRankingMode } from "@/lib/champion-rankings";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getMatches,
  getPlayerStatLines,
  getSets,
  getSetPicksBans,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import {
  filterPicksBansByMatches,
  filterSetsByMatches,
  filterStatLinesByMatchIds,
} from "@/lib/tournament-filters";
import { segmentForTournament, type SeasonSegmentKey } from "@/lib/tournaments/season-2026";
import type {
  Match,
  PlayerPosition,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Team,
  TeamStanding,
  Tournament,
} from "@/lib/types";
import { buildTeamStandingRows } from "@/lib/view-data";
import { ChampionRankingTable } from "./champion-ranking-table";
import { StandingsFilter, type StandingsPosition, type StandingsView } from "./standings-filter";

type StandingsCompetition = {
  id: SeasonSegmentKey;
  name: string;
};

type CompetitionOption = StandingsCompetition & {
  tournamentIds: Set<string>;
};

const STANDINGS_COMPETITIONS: StandingsCompetition[] = [
  { id: "lck-cup", name: "LCK CUP" },
  { id: "first-stand", name: "퍼스트 스탠드" },
  { id: "lck", name: "LCK" },
  { id: "msi", name: "MSI" },
  { id: "ewc", name: "EWC" },
  { id: "enc", name: "ENC" },
  { id: "worlds", name: "월즈" },
];

const DEFAULT_COMPETITION_ID: SeasonSegmentKey = "lck";
const PLAYER_POSITIONS: PlayerPosition[] = ["TOP", "JGL", "MID", "BOT", "SUP"];

function parseView(raw: string | undefined): StandingsView {
  if (raw === "players") return "players";
  if (raw === "champions") return "champions";
  return "teams";
}

function parsePosition(raw: string | undefined): StandingsPosition {
  return PLAYER_POSITIONS.includes(raw as PlayerPosition)
    ? (raw as PlayerPosition)
    : "all";
}

function parseChampionRankMode(raw: string | undefined): ChampionRankingMode {
  if (raw === "ban" || raw === "pick") return raw;
  return "combined";
}

function parseSeason(raw: string | undefined, seasons: number[], fallback: number) {
  const parsed = raw ? Number(raw) : Number.NaN;
  return seasons.includes(parsed) ? parsed : fallback;
}

function competitionKeyForTournament(tournament: Tournament) {
  return segmentForTournament(tournament);
}

function hasMeaningfulStandingData(standing: TeamStanding) {
  return (
    standing.wins !== 0 ||
    standing.losses !== 0 ||
    standing.setDiff !== 0 ||
    standing.kills !== 0 ||
    standing.deaths !== 0 ||
    standing.assists !== 0 ||
    standing.kda != null ||
    standing.winRate != null
  );
}

function hasCompetitionData({
  tournamentIds,
  matches,
  sets,
  picksBans,
  statLines,
  standings,
}: {
  tournamentIds: Set<string>;
  matches: Match[];
  sets: SetResult[];
  picksBans: SetPickBan[];
  statLines: PlayerStatLine[];
  standings: TeamStanding[];
}) {
  const matchIds = new Set<string>();
  let hasCompletedMatch = false;

  for (const match of matches) {
    if (!tournamentIds.has(match.tournamentId)) continue;
    matchIds.add(match.id);
    if (match.status === "completed") {
      hasCompletedMatch = true;
    }
  }

  const setIds = new Set<string>();
  let hasResultSet = false;

  for (const set of sets) {
    if (!matchIds.has(set.matchId)) continue;
    setIds.add(set.id);
    if (set.winnerTeamId || set.status === "finished" || set.status === "data_synced") {
      hasResultSet = true;
    }
  }

  return (
    standings.some(
      (standing) =>
        tournamentIds.has(standing.tournamentId) && hasMeaningfulStandingData(standing),
    ) ||
    hasCompletedMatch ||
    hasResultSet ||
    picksBans.some((item) => setIds.has(item.setId)) ||
    statLines.some((line) => setIds.has(line.setId))
  );
}

function buildCompetitionOptions({
  tournaments,
  matches,
  sets,
  picksBans,
  statLines,
  standings,
}: {
  tournaments: Tournament[];
  matches: Match[];
  sets: SetResult[];
  picksBans: SetPickBan[];
  statLines: PlayerStatLine[];
  standings: TeamStanding[];
}) {
  return STANDINGS_COMPETITIONS.map((competition) => {
    const tournamentIds = new Set(
      tournaments
        .filter((tournament) => competitionKeyForTournament(tournament) === competition.id)
        .map((tournament) => tournament.id),
    );

    if (tournamentIds.size === 0) return null;

    const hasData = hasCompetitionData({
      tournamentIds,
      matches,
      sets,
      picksBans,
      statLines,
      standings,
    });

    return hasData ? { ...competition, tournamentIds } : null;
  }).filter((option): option is CompetitionOption => option != null);
}

function competitionKeyFromParam(raw: string | undefined, tournaments: Tournament[]) {
  if (!raw) return null;

  if (STANDINGS_COMPETITIONS.some((competition) => competition.id === raw)) {
    return raw as SeasonSegmentKey;
  }

  const legacyTournament = tournaments.find((tournament) => tournament.id === raw);
  return legacyTournament ? competitionKeyForTournament(legacyTournament) : null;
}

function defaultCompetition(options: CompetitionOption[]) {
  return (
    options.find((competition) => competition.id === DEFAULT_COMPETITION_ID) ??
    options[0] ??
    null
  );
}

function tournamentTitle(season: number, competition: CompetitionOption | null) {
  return competition ? `${season} ${competition.name}` : String(season);
}

function formatRatio(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatInteger(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toLocaleString();
}

function participantTeams(teams: Team[], matches: Match[], standings: TeamStanding[]) {
  const teamIds = new Set<string>();

  for (const match of matches) {
    teamIds.add(match.teamAId);
    teamIds.add(match.teamBId);
  }

  for (const standing of standings) {
    teamIds.add(standing.teamId);
  }

  return teamIds.size > 0 ? teams.filter((team) => teamIds.has(team.id)) : teams;
}

function isLckSeasonSummary(tournament: Tournament) {
  const normalizedName = tournament.name.trim();
  return /^LCK\s+\d{4}$/i.test(normalizedName) || /^\d{4}\s+LCK$/i.test(normalizedName);
}

function preferredStandingRows({
  competition,
  tournaments,
  standings,
}: {
  competition: CompetitionOption | null;
  tournaments: Tournament[];
  standings: TeamStanding[];
}) {
  if (!competition || standings.length === 0) return [];

  if (competition.id === "lck") {
    const summaryTournamentIds = new Set(
      tournaments.filter((tournament) => isLckSeasonSummary(tournament)).map((tournament) => tournament.id),
    );
    const summaryRows = standings.filter((standing) => summaryTournamentIds.has(standing.tournamentId));

    if (summaryRows.length > 0) {
      return summaryRows;
    }
  }

  const rowsByTournament = new Map<string, TeamStanding[]>();

  for (const standing of standings) {
    const rows = rowsByTournament.get(standing.tournamentId) ?? [];
    rows.push(standing);
    rowsByTournament.set(standing.tournamentId, rows);
  }

  return (
    [...rowsByTournament.entries()]
      .sort((a, b) => {
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;

        const aTournament = tournaments.find((tournament) => tournament.id === a[0]);
        const bTournament = tournaments.find((tournament) => tournament.id === b[0]);
        const aTime = aTournament?.startDate ? new Date(aTournament.startDate).getTime() : 0;
        const bTime = bTournament?.startDate ? new Date(bTournament.startDate).getTime() : 0;
        return bTime - aTime;
      })[0]?.[1] ?? []
  );
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    year?: string;
    tournament?: string;
    view?: string;
    position?: string;
    championRank?: string;
  }>;
}) {
  const params = await searchParams;
  const activeView = parseView(params.view);
  const activePosition = parsePosition(params.position);
  const activeChampionRankMode = parseChampionRankMode(params.championRank);

  const [teams, matches, tournaments, savedStandings, players, champions, sets, picksBans, statLines] =
    await Promise.all([
      getAllTeams(),
      getMatches(),
      getTournaments(),
      getTeamStandings(),
      getAllPlayers(),
      getChampions(),
      getSets(),
      getSetPicksBans(),
      getPlayerStatLines(),
    ]);

  const seasons = [...new Set(tournaments.map((tournament) => tournament.season))].sort((a, b) => b - a);
  const latestSeason = seasons[0] ?? 2026;
  const activeSeason = parseSeason(params.year ?? params.season, seasons, latestSeason);
  const seasonTournaments = tournaments.filter((tournament) => tournament.season === activeSeason);
  const competitionOptions = buildCompetitionOptions({
    tournaments: seasonTournaments,
    matches,
    sets,
    picksBans,
    statLines,
    standings: savedStandings,
  });
  const requestedCompetitionKey = competitionKeyFromParam(params.tournament, seasonTournaments);
  const activeCompetition =
    competitionOptions.find((competition) => competition.id === requestedCompetitionKey) ??
    defaultCompetition(competitionOptions);
  const activeTournamentIds = activeCompetition?.tournamentIds ?? new Set<string>();
  const scopedMatches = matches.filter((match) => activeTournamentIds.has(match.tournamentId));
  const scopedSets = filterSetsByMatches(sets, scopedMatches);
  const savedForCompetition = savedStandings
    .filter(
      (standing) =>
        activeTournamentIds.has(standing.tournamentId) && hasMeaningfulStandingData(standing),
    )
    .sort((a, b) => a.rank - b.rank);
  const preferredStandings = preferredStandingRows({
    competition: activeCompetition,
    tournaments: seasonTournaments,
    standings: savedForCompetition,
  });
  const standingsTeams = participantTeams(teams, scopedMatches, preferredStandings);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const teamRows =
    preferredStandings.length > 0
      ? preferredStandings
          .map((standing) => {
            const team = teamMap.get(standing.teamId);
            if (!team) return null;

            return {
              rank: standing.rank,
              team,
              wins: standing.wins,
              losses: standing.losses,
              setDiff: standing.setDiff,
              winRate: formatRatio(standing.winRate),
              kda: formatRatio(standing.kda),
              kills: formatInteger(standing.kills),
              deaths: formatInteger(standing.deaths),
              assists: formatInteger(standing.assists),
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null)
      : buildTeamStandingRows(standingsTeams, scopedMatches, scopedSets).map((row) => {
          const games = row.matchWins + row.matchLosses;

          return {
            rank: row.rank,
            team: row.team,
            wins: row.matchWins,
            losses: row.matchLosses,
            setDiff: row.setDiff,
            winRate: games === 0 ? "-" : formatRatio(row.matchWins / games),
            kda: "-",
            kills: "-",
            deaths: "-",
            assists: "-",
          };
        });

  const pomCounts = new Map<string, number>();
  for (const match of scopedMatches) {
    if (match.officialPomPlayerId) {
      pomCounts.set(
        match.officialPomPlayerId,
        (pomCounts.get(match.officialPomPlayerId) ?? 0) + 1,
      );
    }
  }

  const playerRows = [...pomCounts.entries()]
    .map(([playerId, count]) => ({ player: playerMap.get(playerId), count }))
    .filter((row): row is { player: NonNullable<(typeof row)["player"]>; count: number } => row.player != null)
    .filter((row) => activePosition === "all" || row.player.position === activePosition)
    .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name, "ko"))
    .map((row, index) => ({
      rank: index + 1,
      player: row.player,
      team: teamMap.get(row.player.teamId),
      count: row.count,
    }));

  const scopedPicksBans = filterPicksBansByMatches(picksBans, sets, scopedMatches);
  const scopedStatLines = filterStatLinesByMatchIds(statLines, sets, scopedMatches);
  const championRows = buildChampionRankings(
    scopedPicksBans,
    scopedSets,
    champions,
    scopedStatLines,
    activeChampionRankMode,
  );

  const titleSubject =
    activeView === "players" ? "선수 POM 랭킹" : activeView === "champions" ? "챔피언 순위" : "팀 순위";
  const title = `${tournamentTitle(activeSeason, activeCompetition)} ${titleSubject}`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <h1 className="sr-only">{title}</h1>

      <Suspense fallback={null}>
        <StandingsFilter
          seasons={seasons}
          competitions={competitionOptions.map((competition) => ({
            id: competition.id,
            name: competition.name,
          }))}
          activeSeason={activeSeason}
          activeCompetitionId={activeCompetition?.id ?? ""}
          activeView={activeView}
          activePosition={activePosition}
          activeChampionRankMode={activeChampionRankMode}
        />
      </Suspense>

      {activeView === "teams" ? (
        <DataTable
          rows={teamRows}
          columns={[
            {
              key: "team",
              label: "팀 순위",
              headerClassName: "min-w-[18rem]",
              cellClassName: "min-w-[18rem]",
              render: (row) => (
                <div className="flex items-center gap-4">
                  <span className="w-9 shrink-0 text-center text-2xl font-black italic tabular-nums">
                    {row.rank}
                  </span>
                  <Link
                    href={`/teams/${row.team.slug}`}
                    className="flex min-w-0 items-center gap-3 font-semibold hover:text-accent"
                  >
                    {row.team.logoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.team.logoUrl}
                          alt={`${row.team.name} 로고`}
                          className="h-9 w-11 shrink-0 object-contain"
                        />
                      </>
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
              render: (row) => row.wins,
            },
            {
              key: "losses",
              label: "패",
              headerClassName: "text-center",
              cellClassName: "text-center tabular-nums",
              render: (row) => row.losses,
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
            {
              key: "kda",
              label: "KDA",
              headerClassName: "text-center",
              cellClassName: "text-center tabular-nums",
              render: (row) => row.kda,
            },
            {
              key: "kills",
              label: "킬",
              headerClassName: "text-center",
              cellClassName: "text-center tabular-nums",
              render: (row) => row.kills,
            },
            {
              key: "deaths",
              label: "데스",
              headerClassName: "text-center",
              cellClassName: "text-center tabular-nums",
              render: (row) => row.deaths,
            },
            {
              key: "assists",
              label: "어시스트",
              headerClassName: "text-center",
              cellClassName: "text-center tabular-nums",
              render: (row) => row.assists,
            },
          ]}
        />
      ) : activeView === "players" ? (
        <DataTable
          rows={playerRows}
          columns={[
            {
              key: "player",
              label: "선수 순위",
              headerClassName: "min-w-[18rem]",
              cellClassName: "min-w-[18rem]",
              render: (row) => (
                <div className="flex items-center gap-4">
                  <span className="w-9 shrink-0 text-center text-2xl font-black italic tabular-nums">
                    {row.rank}
                  </span>
                  <Link
                    href={`/players/${row.player.slug}`}
                    className="flex min-w-0 items-center gap-3 font-semibold hover:text-accent"
                  >
                    {row.player.profileImageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.player.profileImageUrl}
                          alt={`${row.player.name} 프로필`}
                          className="h-10 w-10 shrink-0 rounded-full bg-surface-muted object-cover"
                        />
                      </>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted">
                        {row.player.name.slice(0, 2)}
                      </span>
                    )}
                    <span className="truncate">{row.player.name}</span>
                  </Link>
                </div>
              ),
            },
            {
              key: "team",
              label: "팀",
              render: (row) =>
                row.team ? (
                  <Link href={`/teams/${row.team.slug}`} className="hover:text-accent">
                    {row.team.shortName}
                  </Link>
                ) : (
                  "-"
                ),
            },
            { key: "position", label: "포지션", render: (row) => row.player.position },
            {
              key: "pom",
              label: "POM 횟수",
              headerClassName: "text-center",
              cellClassName: "text-center font-bold tabular-nums text-accent",
              render: (row) => row.count,
            },
          ]}
        />
      ) : (
        <ChampionRankingTable mode={activeChampionRankMode} rows={championRows} />
      )}
    </main>
  );
}
