export type SeasonSegmentKey =
  | "lck-cup"
  | "first-stand"
  | "lck"
  | "msi"
  | "ewc"
  | "worlds"
  | "enc";

export const DEFAULT_SEASON_YEAR = 2026;

export type SeasonSegment = {
  key: SeasonSegmentKey | "all";
  label: string;
  description: string;
};

export const SEASON_2026_SEGMENTS: SeasonSegment[] = [
  { key: "all", label: "2026 전체", description: "2026 시즌 전체 경기" },
  { key: "lck-cup", label: "LCK Cup", description: "LCK 2026 컵" },
  { key: "first-stand", label: "First Stand", description: "국제 대회 · First Stand" },
  { key: "lck", label: "LCK", description: "LCK 정규 리그" },
  { key: "msi", label: "MSI", description: "Mid-Season Invitational" },
  { key: "ewc", label: "EWC", description: "Esports World Cup" },
  { key: "worlds", label: "Worlds", description: "World Championship" },
  { key: "enc", label: "ENC", description: "Esports Nations Cup" },
];

export type SeasonTournamentConfig = {
  segmentKey: SeasonSegmentKey;
  season: number;
  name: string;
  overviewPage: string;
  split: string;
  category: "domestic" | "international";
  region: string;
  league: string;
  startDate: string;
  endDate: string;
};

export const SEASON_2026_TOURNAMENTS: SeasonTournamentConfig[] = [
  {
    segmentKey: "lck-cup",
    season: 2026,
    name: "LCK Cup 2026",
    overviewPage: "LCK/2026 Season/Cup",
    split: "Cup",
    category: "domestic",
    region: "Korea",
    league: "LCK",
    startDate: "2026-01-14",
    endDate: "2026-03-01",
  },
  {
    segmentKey: "first-stand",
    season: 2026,
    name: "First Stand 2026",
    overviewPage: "2026 First Stand",
    split: "First Stand",
    category: "international",
    region: "International",
    league: "First Stand",
    startDate: "2026-03-16",
    endDate: "2026-03-22",
  },
  {
    segmentKey: "lck",
    season: 2026,
    name: "LCK 2026 Rounds 1-2",
    overviewPage: "LCK/2026 Season/Rounds 1-2",
    split: "Rounds 1-2",
    category: "domestic",
    region: "Korea",
    league: "LCK",
    startDate: "2026-04-01",
    endDate: "2026-05-31",
  },
  {
    segmentKey: "lck",
    season: 2026,
    name: "LCK 2026 Road to MSI",
    overviewPage: "LCK/2026 Season/Road to MSI",
    split: "Road to MSI",
    category: "domestic",
    region: "Korea",
    league: "LCK",
    startDate: "2026-06-06",
    endDate: "2026-06-14",
  },
  {
    segmentKey: "lck",
    season: 2026,
    name: "LCK 2026 Rounds 3-4",
    overviewPage: "LCK/2026 Season/Rounds 3-4",
    split: "Rounds 3-4",
    category: "domestic",
    region: "Korea",
    league: "LCK",
    startDate: "2026-07-01",
    endDate: "2026-08-31",
  },
  {
    segmentKey: "lck",
    season: 2026,
    name: "LCK 2026 Season Play-In",
    overviewPage: "LCK/2026 Season/Season Play-In",
    split: "Season Play-In",
    category: "domestic",
    region: "Korea",
    league: "LCK",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
  },
  {
    segmentKey: "lck",
    season: 2026,
    name: "LCK 2026 Season Playoffs",
    overviewPage: "LCK/2026 Season/Season Playoffs",
    split: "Season Playoffs",
    category: "domestic",
    region: "Korea",
    league: "LCK",
    startDate: "2026-09-15",
    endDate: "2026-09-30",
  },
  {
    segmentKey: "msi",
    season: 2026,
    name: "MSI 2026",
    overviewPage: "2026 Mid-Season Invitational",
    split: "MSI",
    category: "international",
    region: "International",
    league: "MSI",
    startDate: "2026-06-26",
    endDate: "2026-07-12",
  },
  {
    segmentKey: "ewc",
    season: 2026,
    name: "EWC 2026",
    overviewPage: "Esports World Cup/2026/League of Legends",
    split: "EWC",
    category: "international",
    region: "International",
    league: "EWC",
    startDate: "2026-07-15",
    endDate: "2026-07-19",
  },
  {
    segmentKey: "worlds",
    season: 2026,
    name: "Worlds 2026",
    overviewPage: "2026 Season World Championship",
    split: "Worlds",
    category: "international",
    region: "International",
    league: "Worlds",
    startDate: "2026-10-15",
    endDate: "2026-11-14",
  },
  {
    segmentKey: "enc",
    season: 2026,
    name: "ENC 2026",
    overviewPage: "2026 Esports Nations Cup",
    split: "ENC",
    category: "international",
    region: "International",
    league: "ENC",
    startDate: "2026-11-21",
    endDate: "2026-11-29",
  },
];

const SEGMENT_BY_OVERVIEW_PAGE = new Map(
  SEASON_2026_TOURNAMENTS.map((tournament) => [
    `${tournament.season}:${tournament.overviewPage}`,
    tournament.segmentKey,
  ]),
);

const SEGMENT_BY_SPLIT = new Map(
  SEASON_2026_TOURNAMENTS.map((tournament) => [
    `${tournament.season}:${tournament.split}`,
    tournament.segmentKey,
  ]),
);

export function parseSeasonSegment(value: string | undefined): SeasonSegmentKey | "all" {
  if (!value || value === "all") {
    return "all";
  }

  return SEASON_2026_SEGMENTS.some((segment) => segment.key === value)
    ? (value as SeasonSegmentKey)
    : "all";
}

export function segmentLabel(segment: SeasonSegmentKey | "all", seasonYear = DEFAULT_SEASON_YEAR) {
  if (segment === "all") {
    return `${seasonYear} 전체`;
  }

  return SEASON_2026_SEGMENTS.find((item) => item.key === segment)?.label ?? `${seasonYear} 전체`;
}

export function segmentForTournament(tournament: {
  season?: number | null;
  sourceTournamentId?: string | null;
  split?: string | null;
  league?: string | null;
}): SeasonSegmentKey | null {
  const season = tournament.season ?? DEFAULT_SEASON_YEAR;

  if (tournament.sourceTournamentId) {
    const byOverview = SEGMENT_BY_OVERVIEW_PAGE.get(`${season}:${tournament.sourceTournamentId}`);
    if (byOverview) {
      return byOverview;
    }
  }

  if (tournament.split) {
    const bySplit = SEGMENT_BY_SPLIT.get(`${season}:${tournament.split}`);
    if (bySplit) {
      return bySplit;
    }
  }

  if (tournament.league === "LCK" && tournament.split === "Cup") {
    return "lck-cup";
  }

  if (tournament.league === "LCK") {
    return "lck";
  }

  if (tournament.league === "First Stand" || tournament.split === "First Stand") {
    return "first-stand";
  }

  if (tournament.league === "MSI" || tournament.split === "MSI") {
    return "msi";
  }

  if (tournament.league === "EWC" || tournament.split === "EWC") {
    return "ewc";
  }

  if (tournament.league === "Worlds" || tournament.split === "Worlds") {
    return "worlds";
  }

  if (tournament.league === "ENC" || tournament.split === "ENC") {
    return "enc";
  }

  return null;
}

export function tournamentIdsForSegment(
  tournaments: Array<{
    id: string;
    season?: number | null;
    sourceTournamentId?: string | null;
    split?: string | null;
    league?: string | null;
  }>,
  segment: SeasonSegmentKey | "all",
  seasonYear = DEFAULT_SEASON_YEAR,
) {
  const seasonTournaments = tournaments.filter((tournament) => tournament.season === seasonYear);

  if (segment === "all") {
    return new Set(seasonTournaments.map((tournament) => tournament.id));
  }

  return new Set(
    seasonTournaments
      .filter((tournament) => segmentForTournament(tournament) === segment)
      .map((tournament) => tournament.id),
  );
}
