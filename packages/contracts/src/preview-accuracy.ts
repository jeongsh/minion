/** 비율 공개에 필요한 전체 경기와 구간별 최소 표본 수. */
export const ACCURACY_MIN_GRADED = 20;
export const ACCURACY_MIN_SEGMENT = 10;

export function accuracyRate(bucket: { hits: number; graded: number }, minimum = ACCURACY_MIN_GRADED) {
  return bucket.graded >= minimum ? Math.round(bucket.hits / bucket.graded * 100) : null;
}
