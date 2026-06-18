import type { DerivedPlayerStats, PlayerStatLine } from "@/lib/types";

type Scale = {
  min: number;
  max: number;
  winsorMin: number;
  winsorMax: number;
  mean: number;
};

type PlayerRadarScales = {
  kda: Scale;
  dpm: Scale;
  vision: Scale;
  csm: Scale;
  goldDiffAt10: Scale;
  xpDiffAt10: Scale;
  goldDiffAt15: Scale;
  xpDiffAt15: Scale;
};

export type PlayerRadarBenchmark = PlayerRadarScales & {
  average: DerivedPlayerStats;
};

function round(value: number, decimals = 2) {
  const unit = 10 ** decimals;
  return Math.round(value * unit) / unit;
}

function perMinute(value: number, minutes: number) {
  return minutes <= 0 ? 0 : value / minutes;
}

function normalize(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, round((value / max) * 100, 1)));
}

function normalizeScale(value: number, scale: Scale | undefined) {
  if (!scale || scale.winsorMax <= scale.winsorMin) {
    return 50;
  }

  const clippedValue = Math.max(scale.winsorMin, Math.min(scale.winsorMax, value));
  return Math.max(0, Math.min(100, round(((clippedValue - scale.winsorMin) / (scale.winsorMax - scale.winsorMin)) * 100, 1)));
}

function scaleFor(values: number[]): Scale {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return { min: 0, max: 0, winsorMin: 0, winsorMax: 0, mean: 0 };
  }
  const sortedValues = [...finiteValues].sort((a, b) => a - b);
  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;

  return {
    min: Math.min(...finiteValues),
    max: Math.max(...finiteValues),
    winsorMin: percentile(sortedValues, 0.05),
    winsorMax: percentile(sortedValues, 0.95),
    mean,
  };
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) {
    return 0;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const clampedPercentile = Math.max(0, Math.min(1, percentileValue));
  const index = (sortedValues.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function average(values: Array<number | null | undefined>) {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

export function calculateKda(kills: number, deaths: number, assists: number) {
  return round((kills + assists) / Math.max(deaths, 1), 2);
}

export function calculateKillParticipation(
  kills: number,
  assists: number,
  teamKills: number,
) {
  return teamKills <= 0 ? 0 : round(((kills + assists) / teamKills) * 100, 1);
}

export function aggregatePlayerStatLine(lines: PlayerStatLine[]): PlayerStatLine | null {
  if (lines.length === 0) {
    return null;
  }

  const total = lines.reduce(
    (acc, line) => ({
      kills: acc.kills + line.kills,
      deaths: acc.deaths + line.deaths,
      assists: acc.assists + line.assists,
      cs: acc.cs + line.cs,
      gold: acc.gold + line.gold,
      damageToChampions: acc.damageToChampions + line.damageToChampions,
      teamKills: acc.teamKills + line.teamKills,
      teamDamage: acc.teamDamage + line.teamDamage,
      gameMinutes: acc.gameMinutes + line.gameMinutes,
      visionScore: acc.visionScore + line.visionScore,
    }),
    {
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      gold: 0,
      damageToChampions: 0,
      teamKills: 0,
      teamDamage: 0,
      gameMinutes: 0,
      visionScore: 0,
    },
  );

  return {
    setId: "aggregate",
    playerId: lines[0].playerId,
    teamId: lines[0].teamId,
    position: lines[0].position,
    championId: null,
    ...total,
    dpm: average(lines.map((line) => line.dpm)),
    damageShare: average(lines.map((line) => line.damageShare)),
    visionScoreAverage: average(lines.map((line) => line.visionScore)),
    visionScorePerMinute: average(lines.map((line) => line.visionScorePerMinute)),
    csPerMinute: average(lines.map((line) => line.csPerMinute)),
    goldDiffAt10: average(lines.map((line) => line.goldDiffAt10)),
    xpDiffAt10: average(lines.map((line) => line.xpDiffAt10)),
    csDiffAt10: average(lines.map((line) => line.csDiffAt10)),
    goldDiffAt15: average(lines.map((line) => line.goldDiffAt15)),
    xpDiffAt15: average(lines.map((line) => line.xpDiffAt15)),
    csDiffAt15: average(lines.map((line) => line.csDiffAt15)),
    itemIds: [],
    spellIds: [],
    runeIds: [],
    roleBoundItem: null,
  };
}

export function createPlayerRadarBenchmark(lines: PlayerStatLine[]): PlayerRadarBenchmark | undefined {
  const grouped = new Map<string, PlayerStatLine[]>();

  for (const line of lines) {
    const list = grouped.get(line.playerId) ?? [];
    list.push(line);
    grouped.set(line.playerId, list);
  }

  const playerStats = Array.from(grouped.values())
    .map((playerLines) => aggregatePlayerStatLine(playerLines))
    .filter((line): line is PlayerStatLine => Boolean(line))
    .map((line) => calculatePlayerStats(line));

  if (playerStats.length < 2) {
    return undefined;
  }

  const benchmark: PlayerRadarScales = {
    kda: scaleFor(playerStats.map((stats) => stats.kda)),
    dpm: scaleFor(playerStats.map((stats) => stats.dpm)),
    vision: scaleFor(playerStats.map((stats) => stats.visionScoreAvg)),
    csm: scaleFor(playerStats.map((stats) => stats.csm)),
    goldDiffAt10: scaleFor(playerStats.map((stats) => stats.goldDiffAt10)),
    xpDiffAt10: scaleFor(playerStats.map((stats) => stats.xpDiffAt10)),
    goldDiffAt15: scaleFor(playerStats.map((stats) => stats.goldDiffAt15)),
    xpDiffAt15: scaleFor(playerStats.map((stats) => stats.xpDiffAt15)),
  };

  const averageLine = {
    setId: "position-average",
    playerId: "position-average",
    teamId: "position-average",
    position: lines[0].position,
    championId: null,
    kills: 0,
    deaths: 0,
    assists: 0,
    cs: 0,
    gold: 0,
    damageToChampions: 0,
    teamKills: 0,
    teamDamage: 0,
    gameMinutes: 0,
    visionScore: 0,
    dpm: benchmark.dpm.mean,
    visionScoreAverage: benchmark.vision.mean,
    csPerMinute: benchmark.csm.mean,
    goldDiffAt10: benchmark.goldDiffAt10.mean,
    xpDiffAt10: benchmark.xpDiffAt10.mean,
    goldDiffAt15: benchmark.goldDiffAt15.mean,
    xpDiffAt15: benchmark.xpDiffAt15.mean,
    itemIds: [],
    spellIds: [],
    runeIds: [],
    roleBoundItem: null,
  } satisfies PlayerStatLine;

  const averageStats = calculatePlayerStats(averageLine, benchmark);
  const averageRadarKda = normalizeScale(benchmark.kda.mean, benchmark.kda);
  const averageFormScore = round(
    (
      averageRadarKda +
      averageStats.radarDpm +
      averageStats.radarVision +
      averageStats.radarCsm +
      averageStats.radarGoldDiffAt10 +
      averageStats.radarXpDiffAt10 +
      averageStats.radarGoldDiffAt15 +
      averageStats.radarXpDiffAt15
    ) / 8,
    1,
  );

  return {
    ...benchmark,
    average: {
      ...averageStats,
      kda: round(benchmark.kda.mean, 2),
      radarKda: averageRadarKda,
      formScore: averageFormScore,
    },
  };
}

export function calculatePlayerStats(line: PlayerStatLine, radarBenchmark?: PlayerRadarScales): DerivedPlayerStats {
  const kda = calculateKda(line.kills, line.deaths, line.assists);
  const kp = calculateKillParticipation(line.kills, line.assists, line.teamKills);
  const dpm = round(line.dpm ?? perMinute(line.damageToChampions, line.gameMinutes), 1);
  const csm = round(line.csPerMinute ?? perMinute(line.cs, line.gameMinutes), 1);
  const gpm = round(perMinute(line.gold, line.gameMinutes), 1);
  const dmgPercent =
    line.damageShare != null
      ? round(line.damageShare * 100, 1)
      : line.teamDamage <= 0
        ? 0
        : round((line.damageToChampions / line.teamDamage) * 100, 1);
  const visionScoreAvg = round(line.visionScoreAverage ?? line.visionScore, 2);
  const goldDiffAt10 = round(line.goldDiffAt10 ?? 0, 1);
  const xpDiffAt10 = round(line.xpDiffAt10 ?? 0, 1);
  const goldDiffAt15 = round(line.goldDiffAt15 ?? 0, 1);
  const xpDiffAt15 = round(line.xpDiffAt15 ?? 0, 1);

  // Fan ratings intentionally stay out of form and radar calculations.
  const radarKda = radarBenchmark ? normalizeScale(kda, radarBenchmark.kda) : normalize(kda, 8);
  const radarDpm = radarBenchmark ? normalizeScale(dpm, radarBenchmark.dpm) : normalize(dpm, 1000);
  const radarVision = radarBenchmark ? normalizeScale(visionScoreAvg, radarBenchmark.vision) : normalize(visionScoreAvg, 3);
  const radarCsm = radarBenchmark ? normalizeScale(csm, radarBenchmark.csm) : normalize(csm, 10);
  const radarGoldDiffAt10 = radarBenchmark ? normalizeScale(goldDiffAt10, radarBenchmark.goldDiffAt10) : normalize(goldDiffAt10 + 800, 1600);
  const radarXpDiffAt10 = radarBenchmark ? normalizeScale(xpDiffAt10, radarBenchmark.xpDiffAt10) : normalize(xpDiffAt10 + 1000, 2000);
  const radarGoldDiffAt15 = radarBenchmark ? normalizeScale(goldDiffAt15, radarBenchmark.goldDiffAt15) : normalize(goldDiffAt15 + 800, 1600);
  const radarXpDiffAt15 = radarBenchmark ? normalizeScale(xpDiffAt15, radarBenchmark.xpDiffAt15) : normalize(xpDiffAt15 + 1000, 2000);
  const formScore = round(
    (radarKda + radarDpm + radarVision + radarCsm + radarGoldDiffAt10 + radarXpDiffAt10 + radarGoldDiffAt15 + radarXpDiffAt15) / 8,
    1,
  );

  return {
    kda,
    kp,
    dpm,
    dmgPercent,
    csm,
    gpm,
    visionScoreAvg,
    goldDiffAt10,
    xpDiffAt10,
    goldDiffAt15,
    xpDiffAt15,
    formScore,
    radarKda,
    radarDpm,
    radarVision,
    radarCsm,
    radarGoldDiffAt10,
    radarXpDiffAt10,
    radarGoldDiffAt15,
    radarXpDiffAt15,
  };
}
