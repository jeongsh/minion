import type { Match, Stage } from "@/lib/types";

export type StageColumn = {
  stage: Stage;
  matches: Match[];
};

/** 스테이지(라운드)별로 매치를 묶고, 첫 경기 일시가 이른 순으로 열을 정렬한다. */
export function buildStageColumns(stages: Stage[], matches: Match[]): StageColumn[] {
  const matchesByStage = new Map<string, Match[]>();

  for (const match of matches) {
    const bucket = matchesByStage.get(match.stageId) ?? [];
    bucket.push(match);
    matchesByStage.set(match.stageId, bucket);
  }

  const columns = stages.map((stage) => {
    const stageMatches = (matchesByStage.get(stage.id) ?? []).sort(
      (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
    );

    return { stage, matches: stageMatches };
  });

  return columns
    .filter((column) => column.matches.length > 0)
    .sort((a, b) => {
      const aTime = new Date(a.matches[0].matchDate).getTime();
      const bTime = new Date(b.matches[0].matchDate).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return a.stage.orderIndex - b.stage.orderIndex;
    });
}

function byMatchDate(a: Match, b: Match) {
  return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
}

function bySideStrict(matches: Match[], side: "upper" | "lower") {
  return matches
    .filter((match) => (side === "upper" ? match.bracketSide !== "lower" : match.bracketSide === "lower"))
    .sort((a, b) => (a.bracketOrder ?? 0) - (b.bracketOrder ?? 0));
}

/**
 * 승자조/패자조로 매치를 나눈다. 관리자가 배치를 저장한 적이 없는 스테이지(모든 매치의
 * bracketSide가 null)는 경기 일시 순으로 절반씩 나누는 임시 배치를 대신 보여준다.
 * 관리자 편집 화면에서 시작점으로 쓰인다.
 */
export function splitBracketSides(matches: Match[]): { upper: Match[]; lower: Match[] } {
  const hasManualSide = matches.some((match) => match.bracketSide != null);

  if (!hasManualSide) {
    const sorted = [...matches].sort(byMatchDate);
    const mid = Math.ceil(sorted.length / 2);
    return { upper: sorted.slice(0, mid), lower: sorted.slice(mid) };
  }

  return { upper: bySideStrict(matches, "upper"), lower: bySideStrict(matches, "lower") };
}

/**
 * 공개 페이지 전용: 관리자가 실제로 배치를 저장하지 않은 스테이지는 승자조/패자조를
 * 임의로 나누지 않고 전체 매치를 하나의 목록으로 보여준다(패자조 영역은 비워둔다).
 * 지어낸 구분을 보여주지 않기 위함 — 실제로 저장된 스테이지만 승자조/패자조로 나뉜다.
 */
export function splitBracketSidesForDisplay(matches: Match[]): { upper: Match[]; lower: Match[] } {
  const hasManualSide = matches.some((match) => match.bracketSide != null);

  if (!hasManualSide) {
    return { upper: [...matches].sort(byMatchDate), lower: [] };
  }

  return { upper: bySideStrict(matches, "upper"), lower: bySideStrict(matches, "lower") };
}
