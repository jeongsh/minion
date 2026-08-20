import type { Match, Stage, Tournament } from "@/lib/types";

/**
 * 매치가 '경기중'인지 판단한다.
 * LoL Esports 동기화가 실제 경기 상태(inProgress)를 확인한 뒤 저장한
 * 명시적인 live 상태만 사용한다. 예정 시각만으로 live를 추론하면 앞 경기가
 * 길어졌을 때 아직 시작하지 않은 다음 경기가 LIVE로 표시될 수 있다.
 */
type MatchDisplayState = Pick<Match, "status"> &
  Partial<Pick<Match, "bestOf" | "teamAScore" | "teamBScore" | "winnerTeamId">>;

/** 동기화가 잠시 늦어 status가 live여도 승부가 결정됐으면 종료로 본다. */
export function isMatchFinished(match: MatchDisplayState) {
  if (match.status === "completed" || match.winnerTeamId) {
    return true;
  }

  if (!match.bestOf || match.teamAScore == null || match.teamBScore == null) {
    return false;
  }

  const winsNeeded = Math.floor(match.bestOf / 2) + 1;
  return Math.max(match.teamAScore, match.teamBScore) >= winsNeeded;
}

export function isMatchLive(match: MatchDisplayState) {
  return match.status === "live" && !isMatchFinished(match);
}

/** 경기 상태 한글 라벨 (예정/진행 중/종료) */
export function matchStatusLabel(status: Match["status"]) {
  if (status === "completed") {
    return "종료";
  }

  if (status === "live") {
    return "진행 중";
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
