import { TRANSFER_KIND_LABELS, type TransferEvent } from "./types";

const PROVENANCE_LABELS: Record<TransferEvent["provenance"], string> = {
  official: "오피셜",
  namuwiki: "오피셜",
  report: "거피셜",
  rumor: "루머",
};

function teamLabel(value: string) {
  return value.replace(/^lp:/i, "").trim();
}

/** 검색엔진·피드용 한 줄 제목. 예: "[루머] Faker 이적 T1 → GEN" */
export function transferEventHeadline(event: TransferEvent) {
  const from = teamLabel(event.from), to = teamLabel(event.to);
  const route = to && to !== from ? `${from} → ${to}` : from;
  return `[${PROVENANCE_LABELS[event.provenance]}] ${event.player} ${TRANSFER_KIND_LABELS[event.kind]}${route ? ` ${route}` : ""}`;
}

/** 피드 항목 시각. 수동 저장 시각이 없으면 발표일(KST 자정)을 쓴다. */
export function transferEventTime(event: TransferEvent) {
  const value = event.updatedAt ?? (event.date ? `${event.date}T00:00:00+09:00` : null);
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

/** 최근 저장·발표 순으로 정렬한다. */
export function recentTransferEvents(events: TransferEvent[], limit: number) {
  return events
    .map((event) => ({ event, time: transferEventTime(event) }))
    .filter((item): item is { event: TransferEvent; time: number } => item.time !== null)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
}
