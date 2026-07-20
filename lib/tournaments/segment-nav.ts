import {
  DOMESTIC_SEGMENTS,
  INTERNATIONAL_SEGMENTS,
  type InternationalSegmentTheme,
} from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Match, Tournament } from "@/lib/types";

export const ALL_SEGMENTS: InternationalSegmentTheme[] = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];

export type SegmentNavItem = InternationalSegmentTheme & {
  startDate: string | null;
  endDate: string | null;
  region: string;
  isOngoing: boolean;
};

// 대회 카드는 여러 스플릿(예: LCK의 Cup/Rounds 1-2/Rounds 3-4)을 합쳐서 보여주는데,
// 이 스플릿들의 시작~종료일 전체 범위로 "진행중"을 판단하면 스플릿 사이 휴식기간(EWC
// 브레이크 등 실제 경기가 없는 기간)에도 진행중으로 표시된다. 그래서 대회 메타데이터의
// 날짜 범위 대신, 실제로 경기가 있는지(라이브 중이거나 최근/가까운 미래에 경기가 있는지)로
// 판단한다.
const ONGOING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function isSegmentOngoing(matches: Match[], tournamentIds: Set<string>, now: Date) {
  const nowMs = now.getTime();
  const segmentMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  // 아직 안 끝난(완료되지 않은) 경기가 하나도 없으면 그 세그먼트는 완전히 종료된 것이다.
  // 이 경우 "최근 종료" 유예(ONGOING_WINDOW_MS)를 주지 않아야 EWC처럼 대회가 끝난 뒤에도
  // 며칠간 진행중 표시가 남는 문제가 없다. 유예는 어디까지나 마지막 경기가 방금 끝났거나
  // (아직 다음 경기가 남아있는) 스플릿 사이 휴식기간을 위한 것이다.
  const hasUpcoming = segmentMatches.some((match) => match.status !== "completed");

  return segmentMatches.some((match) => {
    if (match.status === "live") return true;
    const matchMs = new Date(match.matchDate).getTime();
    if (!Number.isFinite(matchMs) || Math.abs(matchMs - nowMs) > ONGOING_WINDOW_MS) return false;
    return matchMs >= nowMs || hasUpcoming;
  });
}

/**
 * 대회 스위처에 노출할 세그먼트 목록. 해당 시즌에 등록된 대회가 하나도 없는 세그먼트는
 * 제외한다.
 */
export function buildSegmentNav(
  tournaments: Tournament[],
  matches: Match[],
  now: Date = new Date(),
): SegmentNavItem[] {
  return ALL_SEGMENTS.map((segment): SegmentNavItem | null => {
    const matched = tournaments.filter((tournament) => matchesTournamentSegment(tournament, segment.key));

    if (matched.length === 0) return null;

    const starts = matched
      .map((tournament) => tournament.startDate)
      .filter((value): value is string => Boolean(value))
      .sort();
    const ends = matched
      .map((tournament) => tournament.endDate)
      .filter((value): value is string => Boolean(value))
      .sort();
    const tournamentIds = new Set(matched.map((tournament) => tournament.id));

    return {
      ...segment,
      startDate: starts[0] ?? null,
      endDate: ends[ends.length - 1] ?? null,
      region: matched[0]?.region ?? "International",
      isOngoing: isSegmentOngoing(matches, tournamentIds, now),
    };
  }).filter((item): item is SegmentNavItem => item != null);
}

/**
 * /tournaments 진입 시 기본으로 보여줄 대회. 진행중인 대회가 있으면 그쪽을, 없으면 LCK를
 * (그마저 없으면 첫 세그먼트를) 고른다.
 */
export function defaultSegmentKey(items: SegmentNavItem[]) {
  return (
    items.find((item) => item.isOngoing)?.key ??
    items.find((item) => item.key === "lck")?.key ??
    items[0]?.key ??
    "lck"
  );
}
