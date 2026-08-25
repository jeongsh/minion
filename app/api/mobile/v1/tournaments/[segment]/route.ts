import type { MobileStandingsGroup, MobileTournamentDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getBracketStages, getMatches, getPlayers, getStages, getTournaments } from "@/lib/data/lck";
import { mobileError, mobileSuccess, toMobilePlayer, toMobileStandingRow, toMobileTeam } from "@/lib/mobile/api-response";
import { isGroupBracketStage, isWeekStage, buildStageColumns } from "@/lib/tournaments/bracket";
import { buildBracketData } from "@/lib/tournaments/bracket-view";
import { segmentThemeByKey } from "@/lib/tournaments/international-segments";
import { buildSegmentNav } from "@/lib/tournaments/segment-nav";
import {
  buildPomRankingRows,
  deriveCrossGroups,
  deriveMatchGroups,
  LCK_SPLIT_LABELS,
  LCK_SPLIT_VIEW_LABELS,
  type LckSplitKey,
} from "@/lib/tournaments/standings";
import { isSupportedSeasonYear, matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Team, Tournament } from "@/lib/types";
import { buildTeamStandingRows, dateKeyKST } from "@/lib/view-data";

export const revalidate = 300;

function findGenG(teams: Team[]) {
  return teams.find((team) => team.shortName === "GEN" || /gen\.?g/i.test(team.name));
}

export async function GET(request: Request, context: { params: Promise<{ segment: string }> }) {
  const { segment: segmentKey } = await context.params;
  const segmentTheme = segmentThemeByKey(segmentKey);
  if (!segmentTheme) return mobileError("NOT_FOUND", "대회를 찾을 수 없습니다.", 404);

  const search = new URL(request.url).searchParams;
  const [tournaments, stages, matches, teams, bracketStages, players] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
    getBracketStages(),
    getPlayers(),
  ]);

  const segmentTournaments = tournaments.filter((tournament) => matchesTournamentSegment(tournament, segmentTheme.key));
  if (segmentTournaments.length === 0) return mobileError("NOT_FOUND", "대회를 찾을 수 없습니다.", 404);

  const seasons = [...new Set(segmentTournaments.map((tournament) => tournament.season).filter(isSupportedSeasonYear))].sort((a, b) => b - a);
  const requestedSeason = Number(search.get("year"));
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const seasonTournaments = segmentTournaments.filter((tournament) => tournament.season === activeSeason);

  // 같은 대회가 두 소스(gol.gg/Leaguepedia)에서 중복 수집된 경우, 실제 경기가 채워진 쪽만 쓴다.
  const matchCountByTournament = new Map<string, number>();
  for (const match of matches) matchCountByTournament.set(match.tournamentId, (matchCountByTournament.get(match.tournamentId) ?? 0) + 1);
  const bestBySplit = new Map<string, Tournament>();
  for (const tournament of seasonTournaments) {
    const key = tournament.split ?? tournament.id;
    const current = bestBySplit.get(key);
    if (!current || (matchCountByTournament.get(tournament.id) ?? 0) > (matchCountByTournament.get(current.id) ?? 0)) bestBySplit.set(key, tournament);
  }
  const activeTournaments = [...bestBySplit.values()];
  const tournamentIds = new Set(activeTournaments.map((tournament) => tournament.id));

  const segmentStages = stages.filter((stage) => tournamentIds.has(stage.tournamentId));
  const segmentMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const isLck = segmentTheme.key === "lck";
  const segmentNav = buildSegmentNav(tournaments.filter((tournament) => tournament.season === activeSeason), matches).map((item) => ({
    isOngoing: item.isOngoing,
    key: item.key,
    logo: item.logo ?? null,
    logoAspect: item.logoAspect ?? 1.4,
    name: item.name,
  }));

  const base = {
    activeSeason,
    isLck,
    segment: { accent: segmentTheme.accent, key: segmentTheme.key, logo: segmentTheme.logo ?? null, logoAspect: segmentTheme.logoAspect ?? 1.4, name: segmentTheme.name },
    segmentNav,
    seasons,
  };

  if (isLck) {
    const activeSplit: LckSplitKey = (["1", "2", "3"].includes(search.get("split") ?? "") ? search.get("split") : "1") as LckSplitKey;
    const requestedView = search.get("view");
    const activeView: "pom" | "standings" | "bracket" = requestedView === "bracket" ? "bracket" : requestedView === "pom" ? "pom" : "standings";
    const activePhase: "playin" | "playoffs" = search.get("phase") === "playoffs" ? "playoffs" : "playin";
    const viewLabels = LCK_SPLIT_VIEW_LABELS[activeSplit];

    const cupTournamentIds = new Set(activeTournaments.filter((tournament) => tournament.split === "Cup").map((tournament) => tournament.id));
    const cupMatches = segmentMatches.filter((match) => cupTournamentIds.has(match.tournamentId));
    const cupStages = segmentStages.filter((stage) => cupTournamentIds.has(stage.tournamentId));
    const cupWeekStages = cupStages.filter((stage) => isWeekStage(stage.name));
    const cupOtherStages = cupStages.filter((stage) => !isWeekStage(stage.name));
    const cupWeekMatches = segmentMatches.filter((match) => cupWeekStages.some((stage) => stage.id === match.stageId));
    const cupBracketStages = bracketStages.filter((bracketStage) => cupTournamentIds.has(bracketStage.tournamentId));
    const cupPlayInBracketStage = cupBracketStages.find((bracketStage) => /플레이.?인/.test(bracketStage.name));
    const cupPlayoffBracketStage = cupBracketStages.find((bracketStage) => /플레이오프/.test(bracketStage.name));
    const cupPlayInColumns = buildStageColumns(cupOtherStages.filter((stage) => stage.bracketStageId === cupPlayInBracketStage?.id), segmentMatches);
    const cupPlayoffColumns = buildStageColumns(cupOtherStages.filter((stage) => stage.bracketStageId === cupPlayoffBracketStage?.id), segmentMatches);

    let split1Groups: MobileStandingsGroup[] = [];
    if (cupWeekStages.length > 0) {
      const groupColors = deriveCrossGroups(cupWeekMatches);
      if (groupColors) {
        const genG = findGenG(teams);
        const baronColor: 0 | 1 = (genG ? groupColors.get(genG.id) : undefined) ?? 0;
        const elderColor: 0 | 1 = baronColor === 0 ? 1 : 0;
        const groupATeams = teams.filter((team) => groupColors.get(team.id) === baronColor);
        const groupBTeams = teams.filter((team) => groupColors.get(team.id) === elderColor);
        split1Groups = [
          { rows: buildTeamStandingRows(groupATeams, cupWeekMatches, []).map(toMobileStandingRow), title: "바론 그룹" },
          { rows: buildTeamStandingRows(groupBTeams, cupWeekMatches, []).map(toMobileStandingRow), title: "장로 그룹" },
        ];
      }
    }

    const rounds12Matches = segmentMatches.filter((match) => activeTournaments.some((tournament) => tournament.id === match.tournamentId && tournament.split === "Rounds 1-2"));
    const lckTeams = teams.filter((team) => team.isLckTeam);
    const split2Groups: MobileStandingsGroup[] = [{ rows: buildTeamStandingRows(lckTeams, rounds12Matches, []).map(toMobileStandingRow), title: "정규 시즌" }];

    const roadToMsiTournamentIds = new Set(activeTournaments.filter((tournament) => tournament.split === "Road to MSI").map((tournament) => tournament.id));
    const roadToMsiStages = segmentStages.filter((stage) => roadToMsiTournamentIds.has(stage.tournamentId));
    const roadToMsiColumns = buildStageColumns(roadToMsiStages, segmentMatches);

    const rounds34Matches = segmentMatches.filter((match) => activeTournaments.some((tournament) => tournament.id === match.tournamentId && /^Rounds 3-\d+$/.test(tournament.split ?? "")));
    const regularSeasonMatches = [...rounds12Matches, ...rounds34Matches];

    let split3Groups: MobileStandingsGroup[] = [{ rows: buildTeamStandingRows(lckTeams, regularSeasonMatches, []).map(toMobileStandingRow), title: "" }];
    const rounds34GroupColors = deriveMatchGroups(rounds34Matches);
    if (rounds34GroupColors) {
      const genG = findGenG(teams);
      const legendColor: 0 | 1 = (genG ? rounds34GroupColors.get(genG.id) : undefined) ?? 0;
      const riseColor: 0 | 1 = legendColor === 0 ? 1 : 0;
      const legendTeams = teams.filter((team) => rounds34GroupColors.get(team.id) === legendColor);
      const riseTeams = teams.filter((team) => rounds34GroupColors.get(team.id) === riseColor);
      split3Groups = [
        { rows: buildTeamStandingRows(legendTeams, regularSeasonMatches, []).map(toMobileStandingRow), title: "레전드 그룹" },
        { rows: buildTeamStandingRows(riseTeams, regularSeasonMatches, []).map(toMobileStandingRow), title: "라이즈 그룹" },
      ];
    }

    const playInTournamentIds = new Set(activeTournaments.filter((tournament) => tournament.split === "Season Play-In").map((tournament) => tournament.id));
    const playInStages = segmentStages.filter((stage) => playInTournamentIds.has(stage.tournamentId));
    const playInColumns = buildStageColumns(playInStages, segmentMatches);

    const playoffsTournamentIds = new Set(activeTournaments.filter((tournament) => tournament.split === "Season Playoffs").map((tournament) => tournament.id));
    const playoffsStages = segmentStages.filter((stage) => playoffsTournamentIds.has(stage.tournamentId));
    const playoffsColumns = buildStageColumns(playoffsStages, segmentMatches);

    const standingsBySplit: Record<LckSplitKey, MobileStandingsGroup[]> = { "1": split1Groups, "2": split2Groups, "3": split3Groups };
    const bracketAvailableBySplit: Record<LckSplitKey, boolean> = {
      "1": (activePhase === "playoffs" ? cupPlayoffColumns : cupPlayInColumns).length > 0,
      "2": roadToMsiColumns.length > 0,
      "3": (activePhase === "playoffs" ? playoffsColumns : playInColumns).length > 0,
    };

    const pomMatches = activeSplit === "1" ? cupMatches : regularSeasonMatches;
    const pomRows = buildPomRankingRows(pomMatches, players, teamMap).map((row) => ({
      count: row.count,
      player: toMobilePlayer(row.player),
      points: row.points,
      rank: row.rank,
      team: row.team ? toMobileTeam(row.team) : null,
    }));

    const bracketColumnsBySplit: Record<LckSplitKey, ReturnType<typeof buildStageColumns>> = {
      "1": activePhase === "playoffs" ? cupPlayoffColumns : cupPlayInColumns,
      "2": roadToMsiColumns,
      "3": activePhase === "playoffs" ? playoffsColumns : playInColumns,
    };
    const bracketAvailable = bracketAvailableBySplit[activeSplit];

    const data: MobileTournamentDetailDto = {
      ...base,
      activeBracketStageId: null,
      activePhase,
      activeSplit,
      activeView,
      bracket: activeView === "bracket" && bracketAvailable ? buildBracketData(bracketColumnsBySplit[activeSplit], teamMap) : null,
      bracketAvailable,
      bracketStages: [],
      pomRows: activeView === "pom" ? pomRows : null,
      splitLabels: LCK_SPLIT_LABELS,
      standingsGroups: activeView === "standings" ? standingsBySplit[activeSplit] : null,
      supportsGroupToggle: false,
      viewLabels,
    };
    return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
  }

  const segmentBracketStages = bracketStages.filter((bracketStage) => tournamentIds.has(bracketStage.tournamentId)).sort((a, b) => a.orderIndex - b.orderIndex);
  const todayKey = dateKeyKST(new Date());
  const bracketStageInfo = segmentBracketStages.map((bracketStage) => {
    const stageIds = new Set(segmentStages.filter((stage) => stage.bracketStageId === bracketStage.id).map((stage) => stage.id));
    const stageMatches = segmentMatches.filter((match) => stageIds.has(match.stageId));
    return {
      bracketStage,
      hasToday: stageMatches.some((match) => dateKeyKST(match.matchDate) === todayKey),
      isDone: stageMatches.length > 0 && stageMatches.every((match) => match.status === "completed"),
    };
  });
  const tournamentFullyCompleted = bracketStageInfo.length > 0 && bracketStageInfo.every((info) => info.isDone);
  const currentBracketStage = tournamentFullyCompleted
    ? null
    : (bracketStageInfo.find((info) => info.hasToday) ?? bracketStageInfo.find((info) => !info.isDone && info.bracketStage.displayMode !== "standings") ?? bracketStageInfo.find((info) => !info.isDone))?.bracketStage;
  const activeBracketStage = segmentBracketStages.find((bracketStage) => bracketStage.id === search.get("bracketStage")) ?? currentBracketStage ?? segmentBracketStages[0] ?? null;
  const activeStages = activeBracketStage ? segmentStages.filter((stage) => stage.bracketStageId === activeBracketStage.id) : segmentStages;
  const columns = buildStageColumns(activeStages, segmentMatches);

  const supportsGroupToggle = Boolean(activeBracketStage && isGroupBracketStage(activeBracketStage.name, activeBracketStage.displayMode));
  const requestedGroupView: "standings" | "bracket" = search.get("view") === "bracket" ? "bracket" : "standings";
  const isGroupStageBracket = supportsGroupToggle && requestedGroupView === "standings";
  const activeStageIds = new Set(activeStages.map((stage) => stage.id));
  const groupStageMatches = segmentMatches.filter((match) => activeStageIds.has(match.stageId));
  const groupStageTeams = teams.filter((team) => groupStageMatches.some((match) => match.teamAId === team.id || match.teamBId === team.id));

  const bracketAvailable = !isGroupStageBracket && columns.length > 0;

  const data: MobileTournamentDetailDto = {
    ...base,
    activeBracketStageId: activeBracketStage?.id ?? null,
    activePhase: null,
    activeSplit: null,
    activeView: isGroupStageBracket ? "standings" : "bracket",
    bracket: bracketAvailable ? buildBracketData(columns, teamMap) : null,
    bracketAvailable,
    bracketStages: segmentBracketStages.map((bracketStage) => ({ id: bracketStage.id, name: bracketStage.name })),
    pomRows: null,
    splitLabels: null,
    standingsGroups: isGroupStageBracket ? [{ rows: buildTeamStandingRows(groupStageTeams, groupStageMatches, []).map(toMobileStandingRow), title: "" }] : null,
    supportsGroupToggle,
    viewLabels: null,
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
}
