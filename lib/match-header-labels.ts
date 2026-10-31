import { compactTournamentName, tournamentDisplayLabel } from "../packages/contracts/src/tournament-label.ts";
import { matchStageLabel } from "./match-display.ts";

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function compactMatchTournamentName(name: string) {
  return compactTournamentName(name);
}

export function compactMatchStageName(name: string, tournament?: Parameters<typeof matchStageLabel>[1]) {
  const label = matchStageLabel(name, tournament);
  if (tournamentDisplayLabel(tournament) === "Worlds") return label;
  return normalizeSpaces(
    name
      .replace(/\bGrand Finals?\b/gi, "Final")
      .replace(/\bQuarterfinals?\b/gi, "QF")
      .replace(/\bSemifinals?\b/gi, "SF")
      .replace(/\bRound\s+(\d+)\b/gi, "R$1")
      .replace(/\bFinals?\b/gi, "Final")
      .replace(/라운드\s*(\d+)/g, "R$1")
      .replace(/결승/g, "Final"),
  );
}
