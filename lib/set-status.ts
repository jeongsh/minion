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
