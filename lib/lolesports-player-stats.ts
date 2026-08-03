const MIN_CHAMPION_LEVEL = 1;
const MAX_CHAMPION_LEVEL = 18;

export function normalizeChampionLevel(value: number | null | undefined) {
  return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= MIN_CHAMPION_LEVEL &&
      value <= MAX_CHAMPION_LEVEL
    ? value
    : null;
}
