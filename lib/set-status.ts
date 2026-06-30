import type { SetResult, SetStatus } from "@/lib/types";

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

export function isSetRatingOpen(
  set: Pick<SetResult, "status"> | { status?: SetStatus | null },
) {
  return set.status === "finished" || set.status === "data_synced";
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
