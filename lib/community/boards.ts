// 게시판 설정 단일 소스(Single source of truth).
// 네비게이션/페이지/데이터 계층이 이 정의를 참조한다(중복 제거).

export type BoardScope = "hub" | "team";

export type BoardDef = {
  /** board_type 슬러그 (DB 저장값) */
  slug: string;
  /** 한글 라벨 (UI 노출 문구) */
  label: string;
  /** 게시판 범위 */
  scope: BoardScope;
};

// 허브 커뮤니티 (app/community)
export const hubBoards: BoardDef[] = [
  { slug: "live", label: "실시간", scope: "hub" },
  { slug: "analysis", label: "분석", scope: "hub" },
  { slug: "discussion", label: "토론", scope: "hub" },
  { slug: "news", label: "소식", scope: "hub" },
  { slug: "strategy", label: "전략", scope: "hub" },
  { slug: "question", label: "질문", scope: "hub" },
  { slug: "free", label: "자유", scope: "hub" },
];

// 팀 팬사이트 커뮤니티 (app/fan/[teamSlug]/community)
export const teamBoards: BoardDef[] = [
  { slug: "live", label: "실시간", scope: "team" },
  { slug: "discussion", label: "토론", scope: "team" },
  { slug: "news", label: "소식", scope: "team" },
  { slug: "fanart", label: "팬아트", scope: "team" },
  { slug: "onsite", label: "직관", scope: "team" },
  { slug: "free", label: "자유", scope: "team" },
];

/** scope 별 말머리(카테고리) 목록. 단일 피드의 필터 칩/글쓰기 드롭다운에 사용. */
export function categoriesForScope(scope: BoardScope): BoardDef[] {
  return scope === "hub" ? hubBoards : teamBoards;
}

/** 글쓰기 기본 말머리. 탭 노출 순서와 무관하게 자유를 우선한다. */
export function defaultCategory(scope: BoardScope): string {
  const categories = categoriesForScope(scope);
  return categories.find((category) => category.slug === "free")?.slug
    ?? categories[0]?.slug
    ?? "free";
}

export function getHubBoard(slug: string): BoardDef | undefined {
  return hubBoards.find((board) => board.slug === slug);
}

export function getTeamBoard(slug: string): BoardDef | undefined {
  return teamBoards.find((board) => board.slug === slug);
}

export function getBoard(scope: BoardScope, slug: string): BoardDef | undefined {
  return scope === "hub" ? getHubBoard(slug) : getTeamBoard(slug);
}

/** 게시판 라벨 조회(없으면 슬러그 그대로). */
export function boardLabel(scope: BoardScope, slug: string): string {
  return getBoard(scope, slug)?.label ?? slug;
}
