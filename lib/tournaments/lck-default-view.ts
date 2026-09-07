import type { BracketStage, Match, Stage, Tournament } from "../types.ts";
import type { LckSplitKey } from "./standings.ts";

type Selection = { split: LckSplitKey; view: "standings" | "bracket"; phase: "playin" | "playoffs" };

/** 진행·종료된 최신 경기 기준. 시즌 시작 전에는 첫 예정 경기 단계로 진입한다. */
export function getLckDefaultView(
  matches: Match[],
  tournaments: Tournament[],
  stages: Stage[],
  bracketStages: BracketStage[],
  requestedSplit?: LckSplitKey,
): Selection {
  const tournamentMap = new Map(tournaments.map((item) => [item.id, item]));
  const stageMap = new Map(stages.map((item) => [item.id, item]));
  const bracketMap = new Map(bracketStages.map((item) => [item.id, item]));
  const candidates: Array<{ match: Match; selection: Selection }> = [];
  for (const match of matches) {
    const split = tournamentMap.get(match.tournamentId)?.split;
    let selection: Selection;
    if (split === "Cup") {
      const stage = stageMap.get(match.stageId);
      const bracket = stage ? bracketMap.get(stage.bracketStageId) : undefined;
      const isGroup = /^week\s*\d+$/i.test(stage?.name.trim() ?? "") || bracket?.displayMode === "standings";
      selection = { split: "1", view: isGroup ? "standings" : "bracket", phase: /플레이.?인|play.?in/i.test(bracket?.name ?? "") ? "playin" : "playoffs" };
    } else if (split === "Rounds 1-2" || split === "Road to MSI") {
      selection = { split: "2", view: split === "Road to MSI" ? "bracket" : "standings", phase: "playin" };
    } else if (/^Rounds 3-\d+$/.test(split ?? "") || split === "Season Play-In" || split === "Season Playoffs") {
      selection = { split: "3", view: split?.startsWith("Rounds") ? "standings" : "bracket", phase: split === "Season Playoffs" ? "playoffs" : "playin" };
    } else {
      continue;
    }
    if ((!requestedSplit || selection.split === requestedSplit) && Number.isFinite(Date.parse(match.matchDate))) {
      candidates.push({ match, selection });
    }
  }
  const played = candidates.filter(({ match }) => match.status === "live" || match.status === "completed")
    .sort((a, b) => Date.parse(b.match.matchDate) - Date.parse(a.match.matchDate));
  const upcoming = candidates.filter(({ match }) => match.status === "scheduled")
    .sort((a, b) => Date.parse(a.match.matchDate) - Date.parse(b.match.matchDate));
  return (played[0] ?? upcoming[0])?.selection ?? { split: requestedSplit ?? "1", view: "standings", phase: "playin" };
}
