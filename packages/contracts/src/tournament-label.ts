/** Shared display names only. Source IDs and split values retain their original identity. */
export function compactTournamentName(name: string): string {
  const label = name.trim().replace(/\s+/g, " ");
  const withoutYear = label.replace(/\b(?:19|20)\d{2}\b/g, "").trim().replace(/\s+/g, " ");
  if (/^(?:Demacia Cup(?: Global Invitational)?|데마시아\s*컵)$/i.test(withoutYear)) return "Demacia Cup";
  if (/^(?:First Stand|퍼스트\s*스탠드)$/i.test(withoutYear)) return "First Stand";
  if (/^(?:MSI|Mid-Season Invitational)$/i.test(withoutYear)) return "MSI";
  if (/^(?:EWC|Esports World Cup)$/i.test(withoutYear)) return "EWC";
  if (/^(?:ENC|Esports Nations Cup)$/i.test(withoutYear)) return "ENC";
  if (/^(?:Worlds|(?:Season )?World Championship|월드 챔피언십|월즈)$/i.test(withoutYear)) return "Worlds";
  if (/^(?:(?:LoL )?KeSPA Cup|케스파컵)$/i.test(withoutYear)) return "KeSPA Cup";
  if (/^LCK\b/i.test(withoutYear)) {
    return withoutYear.replace(/\bRounds\s+(\d+-\d+)\b/i, "R$1").replace(/\bSeason\s+(Play-In|Playoffs)\b/i, "$1").replace(/\bRegular Season\b/i, "Regular");
  }
  return label;
}

type TournamentLabelInput = {
  name: string;
  league?: string | null;
  split?: string | null;
  category?: string;
};

export function tournamentDisplayLabel(tournament?: TournamentLabelInput | null): string {
  if (!tournament) return "-";
  if (tournament.split === "Cup") return "LCK Cup";
  if (tournament.league === "LCK" && tournament.split) return compactTournamentName(`LCK ${tournament.split}`);
  return compactTournamentName(tournament.name || tournament.league || tournament.split || "-");
}
