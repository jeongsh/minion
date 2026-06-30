// 랭크(티어/LP) 시스템 설정 상수.
// 티어 임계값, 한글 라벨, LP reason별 delta, 챌린저 cap 등을 한 곳에서 관리한다.

import type { LpReason } from "@/lib/rank/record-lp";

export type Tier =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "diamond"
  | "master"
  | "grandmaster"
  | "challenger";

// 아이언 구간 최저 LP(이하로 내려가지 않음). LP < bronze 임계면 아이언.
export const MIN_LP = -100;

// LP 임계값(누적 LP가 이 값 이상이면 해당 티어). 오름차순.
// iron은 lp < bronze(0)일 때 적용되며, iron 키 값은 진행도 표시용 하한(MIN_LP)이다.
// challenger는 임계값(grandmaster와 동일선상) + "상위 50명 cap"으로 별도 처리한다.
export const TIER_THRESHOLDS: Record<Exclude<Tier, "challenger">, number> = {
  iron: MIN_LP,
  bronze: 0, // 가입 시작 등급
  silver: 1000,
  gold: 2500,
  platinum: 5000,
  emerald: 9000,
  diamond: 14000,
  master: 22000,
  grandmaster: 32000,
};

// 한글 라벨 매핑
export const TIER_LABELS: Record<Tier, string> = {
  iron: "아이언",
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  platinum: "플래티넘",
  emerald: "에메랄드",
  diamond: "다이아",
  master: "마스터",
  grandmaster: "그랜드마스터",
  challenger: "챌린저",
};

// 표시/진행도 계산용 순서(낮은 → 높은).
export const TIER_ORDER: Tier[] = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
];

// 가입 시작 티어
export const DEFAULT_TIER: Tier = "bronze";

// 챌린저 정원(상위 50명 제한)
export const CHALLENGER_CAP = 50;

// LP reason별 delta (조정 가능)
export const LP_DELTAS: Record<LpReason, number> = {
  attendance: 10, // 출첵
  post_created: 5, // 글 작성
  comment_created: 2, // 댓글 작성
  honor_received: 3, // 명예(좋아요) 받음
  honor_removed: -3, // 명예 취소
  dishonor_received: -3, // 디스(싫어요) 받음
  reported: -10, // 리폿 누적 제재
};

// 누적 LP만으로 결정되는 "기본 티어"(챌린저 cap 미반영).
// grandmaster 임계 이상은 모두 grandmaster로 본다. challenger 승격은 cap 로직에서 처리.
export function baseTierForLp(lp: number): Exclude<Tier, "challenger"> {
  const floored = Math.floor(lp);
  if (floored < TIER_THRESHOLDS.bronze) {
    return "iron";
  }
  // 높은 티어부터 검사
  const ordered: Exclude<Tier, "challenger">[] = [
    "grandmaster",
    "master",
    "diamond",
    "emerald",
    "platinum",
    "gold",
    "silver",
    "bronze",
  ];
  for (const tier of ordered) {
    if (floored >= TIER_THRESHOLDS[tier]) {
      return tier;
    }
  }
  return "bronze";
}

// 다음 티어까지 진행도 정보. challenger는 최상위라 next 없음.
export type TierProgress = {
  tier: Tier;
  label: string;
  lp: number;
  nextTier: Tier | null;
  nextTierLabel: string | null;
  currentThreshold: number; // 현재 티어 진입 LP
  nextThreshold: number | null; // 다음 티어 진입 LP
  lpIntoTier: number; // 현재 티어 내에서 쌓은 LP
  lpForNext: number | null; // 다음 티어까지 필요한 총 구간 LP
  progressRatio: number; // 0~1
};

export function tierProgress(tier: Tier, lp: number): TierProgress {
  const clamped = Math.max(MIN_LP, Math.floor(lp));
  const idx = TIER_ORDER.indexOf(tier);

  if (tier === "iron") {
    const bronzeThreshold = TIER_THRESHOLDS.bronze;
    const ironFloor = TIER_THRESHOLDS.iron;
    const span = bronzeThreshold - ironFloor;
    const into = clamped - ironFloor;
    return {
      tier,
      label: TIER_LABELS.iron,
      lp: clamped,
      nextTier: "bronze",
      nextTierLabel: TIER_LABELS.bronze,
      currentThreshold: ironFloor,
      nextThreshold: bronzeThreshold,
      lpIntoTier: into,
      lpForNext: span,
      progressRatio: span > 0 ? Math.min(1, Math.max(0, into / span)) : 0,
    };
  }

  // challenger 또는 마지막 티어: 진행도 100%
  if (tier === "challenger") {
    const threshold = TIER_THRESHOLDS.grandmaster;
    return {
      tier,
      label: TIER_LABELS[tier],
      lp: clamped,
      nextTier: null,
      nextTierLabel: null,
      currentThreshold: threshold,
      nextThreshold: null,
      lpIntoTier: clamped - threshold,
      lpForNext: null,
      progressRatio: 1,
    };
  }

  const currentThreshold = TIER_THRESHOLDS[tier as Exclude<Tier, "challenger">];
  const nextTier = TIER_ORDER[idx + 1] ?? null;

  // 다음 티어가 challenger면, LP 기준으로는 grandmaster가 끝이므로 다음 임계 없음.
  if (!nextTier || nextTier === "challenger") {
    return {
      tier,
      label: TIER_LABELS[tier],
      lp: clamped,
      nextTier: nextTier === "challenger" ? "challenger" : null,
      nextTierLabel: nextTier === "challenger" ? TIER_LABELS.challenger : null,
      currentThreshold,
      nextThreshold: null,
      lpIntoTier: clamped - currentThreshold,
      lpForNext: null,
      progressRatio: 1,
    };
  }

  const nextThreshold = TIER_THRESHOLDS[nextTier as Exclude<Tier, "challenger">];
  const span = nextThreshold - currentThreshold;
  const into = clamped - currentThreshold;
  const ratio = span > 0 ? Math.min(1, Math.max(0, into / span)) : 1;

  return {
    tier,
    label: TIER_LABELS[tier],
    lp: clamped,
    nextTier,
    nextTierLabel: TIER_LABELS[nextTier],
    currentThreshold,
    nextThreshold,
    lpIntoTier: into,
    lpForNext: span,
    progressRatio: ratio,
  };
}
