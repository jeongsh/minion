import type { Match, Stage, Tournament } from "@/lib/types";

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
