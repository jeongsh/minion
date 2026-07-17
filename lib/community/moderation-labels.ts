// 블라인드 안내 문구 단일 소스.
// AI 자동 차단 봇의 서비스명과 주체별 문구를 여기서만 관리한다 — 이름을 바꾸려면 아래 상수 하나만 수정.

import type { BlindSource } from "@/lib/community/types";

/** AI 자동 검수 봇의 서비스명(네이버 '클린봇' 포지션). LoL 소환사 주문 '정화'에서 따옴. */
export const AI_MODERATOR_NAME = "정화봇";

/** 블라인드 마스킹 제목/한 줄 안내. */
export function blindLabel(source: BlindSource | null, target: "post" | "comment"): string {
  const noun = target === "post" ? "게시글" : "댓글";
  if (source === "ai") return `${AI_MODERATOR_NAME}이 차단한 ${noun}입니다`;
  if (source === "admin") return `운영진이 블라인드한 ${noun}입니다`;
  return `신고 누적으로 블라인드된 ${noun}입니다`;
}

/** 상세 접힘 화면의 보조 설명. */
export function blindDescription(source: BlindSource | null): string {
  if (source === "ai") {
    return `${AI_MODERATOR_NAME}(AI)이 커뮤니티 규칙 위반으로 판단한 내용입니다. 운영진 검토 후 확정됩니다.`;
  }
  return "운영진 검토 중인 내용으로, 부적절할 수 있습니다.";
}
