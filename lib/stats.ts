import type { DerivedPlayerStats, PlayerStatLine } from "@/lib/types";

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

export function calculatePlayerStats(line: PlayerStatLine): DerivedPlayerStats {
  const kda = calculateKda(line.kills, line.deaths, line.assists);
  const kp = calculateKillParticipation(line.kills, line.assists, line.teamKills);
  const dpm = round(perMinute(line.damageToChampions, line.gameMinutes), 1);
  const csm = round(perMinute(line.cs, line.gameMinutes), 1);
  const gpm = round(perMinute(line.gold, line.gameMinutes), 1);
  const dmgPercent =
    line.teamDamage <= 0
      ? 0
      : round((line.damageToChampions / line.teamDamage) * 100, 1);
  const visionScoreAvg = round(perMinute(line.visionScore, line.gameMinutes), 2);

  // Fan ratings intentionally stay out of form and radar calculations.
  const radarGrowth = normalize(gpm + csm * 30, 900);
  const radarFight = normalize(kp + kda * 12, 145);
  const radarDamage = normalize(dpm + dmgPercent * 10, 1300);
  const radarSurvival = normalize(kda * 20 - line.deaths * 5, 120);
  const radarVision = normalize(visionScoreAvg, 2.8);
  const radarEfficiency = normalize(dpm / Math.max(gpm, 1), 2.2);
  const formScore = round(
    (radarGrowth +
      radarFight +
      radarDamage +
      radarSurvival +
      radarVision +
      radarEfficiency) /
      6,
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
    formScore,
    radarGrowth,
    radarFight,
    radarDamage,
    radarSurvival,
    radarVision,
    radarEfficiency,
  };
}
