export function fanRatingDisplayValue(value: number) {
  return value;
}

export function formatFanRating(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return fanRatingDisplayValue(value).toFixed(1);
}
