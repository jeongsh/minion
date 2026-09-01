function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function compactMatchTournamentName(name: string) {
  return normalizeSpaces(
    name
      .replace(/\b(?:19|20)\d{2}\b/g, "")
      .replace(/\bRegular Season\b/gi, "Regular")
      .replace(/\bSeason\b/gi, "")
      .replace(/\bPlayoffs?\b/gi, "PO")
      .replace(/플레이오프/g, "PO"),
  );
}

export function compactMatchStageName(name: string) {
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
