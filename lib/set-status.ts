import type { SetStatus } from "@/lib/types";

export const SET_STATUS_OPTIONS: Array<{ value: SetStatus; label: string }> = [
  { value: "scheduled", label: "예정" },
  { value: "draft_in_progress", label: "밴픽중" },
  { value: "draft_done", label: "밴픽완료" },
  { value: "finished", label: "경기종료" },
  { value: "data_synced", label: "상세데이터 동기화" },
];

const SET_STATUS_VALUES = new Set<SetStatus>(
  SET_STATUS_OPTIONS.map((option) => option.value),
);

export function normalizeSetStatus(value: unknown): SetStatus {
  return typeof value === "string" && SET_STATUS_VALUES.has(value as SetStatus)
    ? (value as SetStatus)
    : "scheduled";
}

export function setStatusLabel(status: SetStatus | null | undefined) {
  return (
    SET_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "예정"
  );
}

/** 평점 입력은 결과 기록(경기 종료) 시점부터 3시간 동안 열려 있다. */
export const SET_RATING_OPEN_WINDOW_MS = 3 * 60 * 60 * 1000;
/** 커뮤니티 공유용 스냅샷은 결과 기록 20분 후부터 제공한다. */
export const SET_RATING_SNAPSHOT_DELAY_MS = 20 * 60 * 1000;

type SetRatingTiming = {
  status?: SetStatus | null;
  resultRecordedAt?: string | null;
};

/**
 * 평점 입력이 열린(경기종료/상세동기화) 세트의 시작 시각(ms).
 * 상태가 아직 아니거나 기록 시각이 없으면 null.
 */
export function getSetRatingStartedAt(set: SetRatingTiming): number | null {
  if (set.status !== "finished" && set.status !== "data_synced") {
    return null;
  }
  if (!set.resultRecordedAt) {
    return null;
  }
  const startedAt = new Date(set.resultRecordedAt).getTime();
  return Number.isFinite(startedAt) ? startedAt : null;
}

/** 지금 평점 입력이 가능한지 (경기 종료 후 3시간 이내). */
export function isSetRatingOpen(set: SetRatingTiming, now: number = Date.now()) {
  const startedAt = getSetRatingStartedAt(set);
  if (startedAt === null) {
    return false;
  }
  const elapsed = now - startedAt;
  return elapsed >= 0 && elapsed <= SET_RATING_OPEN_WINDOW_MS;
}

/** 커뮤니티 공유용 스냅샷을 제공할 수 있는지 (경기 종료 후 20분 경과). */
export function isSetRatingSnapshotReady(
  set: SetRatingTiming,
  now: number = Date.now(),
) {
  const startedAt = getSetRatingStartedAt(set);
  if (startedAt === null) {
    return false;
  }
  return now - startedAt >= SET_RATING_SNAPSHOT_DELAY_MS;
}

/** 한 세트에 들어온 픽은 팀당 5개씩 총 10개 → 전부 들어오면 밴픽완료로 본다 */
const DRAFT_COMPLETE_PICK_COUNT = 10;

/**
 * 세트에 존재하는 데이터로부터 상태를 도출한다.
 * 우선순위(높을수록 진행도가 큼):
 *  - hasPlayerStats(상세 동기화 완료) → data_synced(상세데이터 동기화)
 *  - hasGameStats(경기 통계 존재)     → finished(경기종료)
 *  - 픽이 전부(10개) 들어옴            → draft_done(밴픽완료)
 *  - 밴픽 데이터가 일부라도 존재        → draft_in_progress(밴픽중)
 *  - 그 외                            → scheduled(예정)
 */
export function deriveSetStatus(data: {
  hasGameStats: boolean;
  hasPlayerStats: boolean;
  pickCount: number;
  banCount: number;
}): SetStatus {
  if (data.hasPlayerStats) {
    return "data_synced";
  }
  if (data.hasGameStats) {
    return "finished";
  }
  if (data.pickCount > 0 || data.banCount > 0) {
    return data.pickCount >= DRAFT_COMPLETE_PICK_COUNT ? "draft_done" : "draft_in_progress";
  }
  return "scheduled";
}
