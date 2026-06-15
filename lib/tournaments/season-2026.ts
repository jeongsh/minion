export type SeasonSegmentKey =
  | "lck-cup"
  | "first-stand"
  | "lck-rounds"
  | "msi"
  | "ewc"
  | "worlds"
  | "enc";

export type SeasonSegment = {
  key: SeasonSegmentKey | "all";
  label: string;
  description: string;
};

export const SEASON_2026_SEGMENTS: SeasonSegment[] = [
  { key: "all", label: "2026 전체", description: "2026 시즌 전체 경기" },
  { key: "lck-cup", label: "LCK Cup", description: "LCK 2026 컵" },
  { key: "first-stand", label: "First Stand", description: "국제 대회 · First Stand" },
  { key: "lck-rounds", label: "LCK Rounds 1-4", description: "라운드 1-2, Road to MSI, 라운드 3-4, 플레이오프" },
  { key: "msi", label: "MSI", description: "Mid-Season Invitational" },
  { key: "ewc", label: "EWC", description: "Esports World Cup" },
  { key: "worlds", label: "Worlds", description: "World Championship" },
  { key: "enc", label: "ENC", description: "Esports Nations Cup" },
];

export type SeasonTournamentConfig = {
  segmentKey: SeasonSegmentKey;
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
    segmentKey: "lck-rounds",
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
    segmentKey: "lck-rounds",
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
    segmentKey: "lck-rounds",
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
    segmentKey: "lck-rounds",
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
    segmentKey: "lck-rounds",
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
  SEASON_2026_TOURNAMENTS.map((tournament) => [tournament.overviewPage, tournament.segmentKey]),
);

const SEGMENT_BY_SPLIT = new Map(
  SEASON_2026_TOURNAMENTS.map((tournament) => [tournament.split, tournament.segmentKey]),
);

export function parseSeasonSegment(value: string | undefined): SeasonSegmentKey | "all" {
  if (!value || value === "all") {
    return "all";
  }

  return SEASON_2026_SEGMENTS.some((segment) => segment.key === value)
    ? (value as SeasonSegmentKey)
    : "all";
}

export function segmentLabel(segment: SeasonSegmentKey | "all") {
  return SEASON_2026_SEGMENTS.find((item) => item.key === segment)?.label ?? "2026 전체";
}

export function segmentForTournament(tournament: {
  sourceTournamentId?: string | null;
  split?: string | null;
  league?: string | null;
}): SeasonSegmentKey | null {
  if (tournament.sourceTournamentId) {
    const byOverview = SEGMENT_BY_OVERVIEW_PAGE.get(tournament.sourceTournamentId);
    if (byOverview) {
      return byOverview;
    }
  }

  if (tournament.split) {
    const bySplit = SEGMENT_BY_SPLIT.get(tournament.split);
    if (bySplit) {
      return bySplit;
    }
  }

  if (tournament.league === "LCK" && tournament.split === "Cup") {
    return "lck-cup";
  }

  return null;
}

export function tournamentIdsForSegment(
  tournaments: Array<{ id: string; sourceTournamentId?: string | null; split?: string | null; league?: string | null }>,
  segment: SeasonSegmentKey | "all",
) {
  if (segment === "all") {
    return new Set(tournaments.map((tournament) => tournament.id));
  }

  return new Set(
    tournaments
      .filter((tournament) => segmentForTournament(tournament) === segment)
      .map((tournament) => tournament.id),
  );
}
