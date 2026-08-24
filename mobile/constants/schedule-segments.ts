/** 웹 lib/tournaments/season-2026.ts(SEASON_2026_SEGMENTS)·international-segments.ts와 값을 그대로 맞춘 대회 세그먼트 목록. */
export type ScheduleSegmentKey = 'lck-cup' | 'first-stand' | 'lck' | 'msi' | 'ewc' | 'worlds' | 'enc' | 'kespa-cup';

export type ScheduleSegmentOption = {
  key: ScheduleSegmentKey | 'all';
  label: string;
  logo?: number;
  logoAspect?: number;
};

export const SCHEDULE_SEGMENTS: ScheduleSegmentOption[] = [
  { key: 'all', label: '전체' },
  { key: 'lck-cup', label: 'LCK Cup', logo: require('@/assets/logos/tournaments/lck.svg'), logoAspect: 205.05 / 145.52 },
  { key: 'first-stand', label: 'First Stand', logo: require('@/assets/logos/tournaments/first-stand.svg'), logoAspect: 1000 / 922 },
  { key: 'lck', label: 'LCK', logo: require('@/assets/logos/tournaments/lck.svg'), logoAspect: 205.05 / 145.52 },
  { key: 'msi', label: 'MSI', logo: require('@/assets/logos/tournaments/msi.svg'), logoAspect: 63.13 / 64 },
  { key: 'ewc', label: 'EWC', logo: require('@/assets/logos/tournaments/ewc.svg'), logoAspect: 133 / 26 },
  { key: 'worlds', label: 'Worlds', logo: require('@/assets/logos/tournaments/worlds.svg'), logoAspect: 1 },
  { key: 'enc', label: 'ENC', logo: require('@/assets/logos/tournaments/enc.webp'), logoAspect: 399 / 90 },
  { key: 'kespa-cup', label: 'KeSPA Cup', logo: require('@/assets/logos/tournaments/kespa-cup.svg'), logoAspect: 200 / 219 },
];

export function isScheduleSegmentKey(value: string): value is ScheduleSegmentKey | 'all' {
  return SCHEDULE_SEGMENTS.some((segment) => segment.key === value);
}
