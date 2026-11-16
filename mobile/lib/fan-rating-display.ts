// Match APIs use the legacy 5-point scale. Player APIs return stored 10-point scores.
export { formatFanRating as formatStoredFanRating } from '../../lib/fan-rating-display';

export function fanRatingDisplayValue(value: number) {
  return value * 2;
}

export function formatFanRating(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '-';
  return fanRatingDisplayValue(value).toFixed(1);
}
