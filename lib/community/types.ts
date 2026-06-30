// 게시판 트랙 전용 타입.
// lib/types.ts 의 CommunityPost(읽기 전용 요약)와 별개로,
// 작성자/명예/리폿/댓글 등 쓰기·상세 흐름에 필요한 필드를 포함한다.

import type { BoardScope } from "@/lib/community/boards";

export type CommunityPostDetail = {
  id: string;
  boardType: string;
  siteScope: BoardScope;
  teamId: string | null;
  title: string;
  content: string;
  authorId: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  reportCount: number;
  createdAt: string;
  /** 갤러리 보기용 대표 썸네일(본문 첫 이미지). 없으면 null. */
  thumbnailUrl: string | null;
  /** 갤러리 카드 보조 텍스트(본문 평문 일부). */
  excerpt: string;
};

export type CommunityCommentItem = {
  id: string;
  postId: string;
  authorId: string | null;
  content: string;
  likeCount: number;
  createdAt: string;
};

// 서버 액션 결과(폼 상태). 비로그인/검증 실패 등을 UI에 전달.
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; requiresLogin?: boolean };
