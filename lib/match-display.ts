import type { Match, Stage, Tournament } from "@/lib/types";

/**
 * 매치가 '경기중'인지 판단한다.
 * - 명시적으로 live 상태이거나
 * - 시작 시각이 지났지만 아직 종료(completed)되지 않은 경우
 * (sync는 보통 scheduled/completed만 세팅하므로 시간 기준으로도 도출한다.)
 */
export function isMatchLive(
  match: Pick<Match, "status" | "matchDate">,
  now: number = Date.now(),
) {
  if (match.status === "completed") {
    return false;
  }
  if (match.status === "live") {
    return true;
  }
  const startedAt = new Date(match.matchDate).getTime();
  return Number.isFinite(startedAt) && startedAt <= now;
}

/** 경기 상태 한글 라벨 (예정/진행/종료) */
export function matchStatusLabel(status: Match["status"]) {
  if (status === "completed") {
    return "종료";
  }

  if (status === "live") {
    return "진행";
  }

  return "예정";
}

/** 토너먼트 종류 라벨 (LCK Cup / First Stand / LCK Spring 등) */
export function tournamentTypeLabel(tournament?: Tournament) {
  if (!tournament) {
    return "-";
  }

  if (tournament.split === "Cup") {
    return "LCK Cup";
  }

  if (tournament.split === "First Stand" || tournament.league === "First Stand") {
    return "First Stand";
  }

  if (tournament.category === "international") {
    return tournament.league ?? tournament.split ?? tournament.name;
  }

  return tournament.split ? `LCK ${tournament.split}` : tournament.league ?? tournament.name;
}

/** 스테이지명 조회 */
export function stageName(stages: Stage[], stageId: string) {
  return stages.find((stage) => stage.id === stageId)?.name ?? "-";
}
