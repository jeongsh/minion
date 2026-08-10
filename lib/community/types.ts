// 게시판 트랙 전용 타입.
// lib/types.ts 의 CommunityPost(읽기 전용 요약)와 별개로,
// 작성자/명예/리폿/댓글 등 쓰기·상세 흐름에 필요한 필드를 포함한다.

import type { BoardScope } from "@/lib/community/boards";
import type { Tier } from "@/lib/rank/config";

/** 리액션 종류. honor=명예(좋아요), dislike=싫어요(디스). */
export type ReactionKind = "honor" | "dislike";
/** 블라인드 주체. ai=정화봇 자동 차단, report=신고 누적, admin=운영자 수동. */
export type BlindSource = "ai" | "report" | "admin";
/** 리액션 대상. */
export type ReactionTarget = "post" | "comment";
/** 현재 사용자의 대상에 대한 stance. 상호 배타(둘 중 하나 또는 없음). */
export type ReactionState = ReactionKind | null;

export type CommunityPostDetail = {
  id: string;
  boardType: string;
  siteScope: BoardScope;
  teamId: string | null;
  title: string;
  content: string;
  authorId: string | null;
  /** 목록/카드에 표시할 작성자 닉네임. 탈퇴 계정은 null. */
  authorName: string | null;
  /** 공개 프로필 이미지. 없으면 UI에서 서비스 기본 아바타를 사용한다. */
  authorImageUrl: string | null;
  /** 작성자의 현재 유효 티어. */
  authorTier: Tier;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  viewCount: number;
  reportCount: number;
  createdAt: string;
  /** 인기글 등재 시각(스냅샷). null 이면 인기글 아님. 등재 후에는 유지된다. */
  hotAt: string | null;
  /** 공지 고정 여부(운영자 설정). 목록 최상단에 고정 노출. */
  isNotice: boolean;
  /** 신고 누적/운영자 조치로 블라인드된 시각. null 이면 정상 노출. */
  blindedAt: string | null;
  /** 블라인드 주체(문구 구분용). blindedAt 이 있을 때만 의미 있다. */
  blindedSource: BlindSource | null;
  /** 소프트 삭제 시각. 일반 목록/상세에서는 제외되고 어드민에서만 보인다. */
  deletedAt: string | null;
  /** 갤러리 보기용 대표 썸네일(본문 첫 이미지). 없으면 null. */
  thumbnailUrl: string | null;
  /** 갤러리 카드 보조 텍스트(본문 평문 일부). */
  excerpt: string;
};

export type CommunityCommentItem = {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string | null;
  authorImageUrl: string | null;
  /** 작성자의 현재 유효 티어. */
  authorTier: Tier;
  content: string;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  /** 신고 누적/운영자 조치로 블라인드된 시각. 본문은 UI에서 접힌다. */
  blindedAt: string | null;
  /** 블라인드 주체(문구 구분용). */
  blindedSource: BlindSource | null;
  /** 소프트 삭제 시각. 본문은 데이터 계층에서 비워져 내려온다. */
  deletedAt: string | null;
};

// 서버 액션 결과(폼 상태). 비로그인/검증 실패 등을 UI에 전달.
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; requiresLogin?: boolean };
