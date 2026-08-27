// 커뮤니티 운영(모더레이션) 전용 데이터 계층.
// 어드민 화면에서만 사용하며, 삭제/블라인드 상태를 포함해 조회해야 하므로 service-role 로 읽는다.
// 유저 트랙(lib/data/community.ts)과 달리 RLS 를 우회한다 — 어드민 라우트 밖에서 import 금지.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunitySettings } from "@/lib/data/community";

// ── 조회용 타입 ──────────────────────────────────────────────────────────

export type AdminPostSummary = {
  id: string;
  siteScope: BoardScope;
  boardType: string;
  title: string;
  excerpt: string;
  authorId: string | null;
  authorName: string | null;
  guestKey: string | null;
  guestIpLabel: string | null;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  reportCount: number;
  createdAt: string;
  hotAt: string | null;
  isNotice: boolean;
  blindedAt: string | null;
  deletedAt: string | null;
};

export type AdminCommentSummary = {
  id: string;
  postId: string;
  excerpt: string;
  authorId: string | null;
  authorName: string | null;
  guestKey: string | null;
  guestIpLabel: string | null;
  createdAt: string;
  blindedAt: string | null;
  deletedAt: string | null;
};

export type AdminReportEntry = {
  reason: string | null;
  reporterName: string | null;
  /** user=이용자 신고, ai=AI 검수 자동 등록. */
  source: "user" | "ai";
  createdAt: string;
};

/** 신고함 한 항목: 대상(글 또는 댓글) 단위로 미처리 신고를 묶는다. */
export type AdminReportGroup = {
  targetType: "post" | "comment";
  post: AdminPostSummary | null;
  comment: AdminCommentSummary | null;
  reports: AdminReportEntry[];
};

type PostRow = {
  id: string;
  site_scope: BoardScope;
  board_type: string;
  title: string;
  content: string;
  author_id: string | null;
  guest_nickname: string | null;
  guest_key: string | null;
  guest_ip_label: string | null;
  like_count: number;
  dislike_count: number | null;
  comment_count: number;
  report_count: number | null;
  created_at: string;
  hot_at: string | null;
  is_notice: boolean | null;
  blinded_at: string | null;
  deleted_at: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  content: string;
  author_id: string | null;
  guest_nickname: string | null;
  guest_key: string | null;
  guest_ip_label: string | null;
  created_at: string;
  blinded_at: string | null;
  deleted_at: string | null;
};

const POST_COLUMNS =
  "id, site_scope, board_type, title, content, author_id, guest_nickname, guest_key, guest_ip_label, like_count, dislike_count, comment_count, report_count, created_at, hot_at, is_notice, blinded_at, deleted_at";

const COMMENT_COLUMNS = "id, post_id, content, author_id, guest_nickname, guest_key, guest_ip_label, created_at, blinded_at, deleted_at";

function mapPost(row: PostRow, nicknames: Map<string, string>, privateIpLabel: string | null = null): AdminPostSummary {
  return {
    id: row.id,
    siteScope: row.site_scope,
    boardType: row.board_type,
    title: row.title,
    excerpt: extractPlainText(row.content),
    authorId: row.author_id,
    authorName: row.author_id ? nicknames.get(row.author_id) ?? null : row.guest_nickname,
    guestKey: row.guest_key,
    guestIpLabel: privateIpLabel ?? row.guest_ip_label,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count ?? 0,
    commentCount: row.comment_count,
    reportCount: row.report_count ?? 0,
    createdAt: row.created_at,
    hotAt: row.hot_at,
    isNotice: row.is_notice ?? false,
    blindedAt: row.blinded_at,
    deletedAt: row.deleted_at,
  };
}

function mapComment(row: CommentRow, nicknames: Map<string, string>, privateIpLabel: string | null = null): AdminCommentSummary {
  return {
    id: row.id,
    postId: row.post_id,
    // 댓글은 에디터 JSON 이 아닌 평문으로 저장되므로 그대로 잘라 쓴다.
    excerpt: row.content.replace(/\s+/g, " ").trim().slice(0, 80),
    authorId: row.author_id,
    authorName: row.author_id ? nicknames.get(row.author_id) ?? null : row.guest_nickname,
    guestKey: row.guest_key,
    guestIpLabel: privateIpLabel ?? row.guest_ip_label,
    createdAt: row.created_at,
    blindedAt: row.blinded_at,
    deletedAt: row.deleted_at,
  };
}

async function fetchNicknames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const { data } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id, nickname")
    .in("id", unique);
  return new Map(
    ((data ?? []) as { id: string; nickname: string | null }[]).flatMap((profile) =>
      profile.nickname ? [[profile.id, profile.nickname] as const] : [],
    ),
  );
}

// ── 신고함 ──────────────────────────────────────────────────────────────

/** 미처리(pending) 신고를 대상(글/댓글) 단위로 묶어 반환. 오래된 신고 순. */
export async function listPendingReportGroups(): Promise<AdminReportGroup[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("post_reports")
    .select("id, post_id, comment_id, reporter_id, reason, source, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;

  type ReportRow = {
    id: string;
    post_id: string | null;
    comment_id: string | null;
    reporter_id: string | null;
    reason: string | null;
    source: "user" | "ai" | null;
    created_at: string;
  };
  const reports = (data ?? []) as ReportRow[];
  if (reports.length === 0) return [];

  const postIds = [...new Set(reports.flatMap((r) => (r.post_id ? [r.post_id] : [])))];
  const commentIds = [...new Set(reports.flatMap((r) => (r.comment_id ? [r.comment_id] : [])))];

  const [postsRes, commentsRes] = await Promise.all([
    postIds.length > 0
      ? supabase.from("community_posts").select(POST_COLUMNS).in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length > 0
      ? supabase.from("community_comments").select(COMMENT_COLUMNS).in("id", commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (postsRes.error) throw postsRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const postRows = (postsRes.data ?? []) as PostRow[];
  const commentRows = (commentsRes.data ?? []) as CommentRow[];

  const [nicknames, postCredentialsRes, commentCredentialsRes] = await Promise.all([
    fetchNicknames([
    ...reports.flatMap((r) => (r.reporter_id ? [r.reporter_id] : [])),
    ...postRows.flatMap((p) => (p.author_id ? [p.author_id] : [])),
    ...commentRows.flatMap((c) => (c.author_id ? [c.author_id] : [])),
    ]),
    postIds.length > 0
      ? supabase.from("community_guest_post_credentials").select("post_id, ip_label").in("post_id", postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length > 0
      ? supabase.from("community_guest_comment_credentials").select("comment_id, ip_label").in("comment_id", commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (postCredentialsRes.error) throw postCredentialsRes.error;
  if (commentCredentialsRes.error) throw commentCredentialsRes.error;
  const postIpLabels = new Map(((postCredentialsRes.data ?? []) as { post_id: string; ip_label: string | null }[]).map((row) => [row.post_id, row.ip_label]));
  const commentIpLabels = new Map(((commentCredentialsRes.data ?? []) as { comment_id: string; ip_label: string | null }[]).map((row) => [row.comment_id, row.ip_label]));

  const postsById = new Map(postRows.map((row) => [row.id, mapPost(row, nicknames, postIpLabels.get(row.id) ?? null)]));
  const commentsById = new Map(commentRows.map((row) => [row.id, mapComment(row, nicknames, commentIpLabels.get(row.id) ?? null)]));

  const groups = new Map<string, AdminReportGroup>();
  for (const report of reports) {
    const key = report.post_id ? `post:${report.post_id}` : `comment:${report.comment_id}`;
    let group = groups.get(key);
    if (!group) {
      group = report.post_id
        ? { targetType: "post", post: postsById.get(report.post_id) ?? null, comment: null, reports: [] }
        : { targetType: "comment", post: null, comment: commentsById.get(report.comment_id!) ?? null, reports: [] };
      groups.set(key, group);
    }
    group.reports.push({
      reason: report.reason,
      reporterName: report.reporter_id ? nicknames.get(report.reporter_id) ?? null : null,
      source: report.source === "ai" ? "ai" : "user",
      createdAt: report.created_at,
    });
  }

  // 대상이 이미 완전 삭제(행 없음)된 신고 그룹은 제외한다.
  return [...groups.values()].filter((group) => group.post || group.comment);
}

/**
 * 대상의 미처리 신고 일괄 처리.
 * - confirm(제재 확정): 신고 confirmed + 블라인드 유지(미설정 시 설정). 호출부에서 작성자 LP 차감.
 * - dismiss(기각): 신고 dismissed + 블라인드 해제(오판 복구).
 * 반환값은 LP 반영에 필요한 작성자 id(없으면 null).
 */
export async function resolveReports(params: {
  postId?: string | null;
  commentId?: string | null;
  action: "confirm" | "dismiss";
}): Promise<{ authorId: string | null }> {
  const supabase = createSupabaseAdminClient();
  const fk = params.postId ? "post_id" : "comment_id";
  const targetId = params.postId ?? params.commentId;
  if (!targetId) return { authorId: null };

  const { error } = await supabase
    .from("post_reports")
    .update({
      status: params.action === "confirm" ? "confirmed" : "dismissed",
      resolved_at: new Date().toISOString(),
    })
    .eq(fk, targetId)
    .eq("status", "pending");
  if (error) throw error;

  const table = params.postId ? "community_posts" : "community_comments";
  const { data } = await supabase
    .from(table)
    .select("author_id, blinded_at")
    .eq("id", targetId)
    .maybeSingle();
  const target = data as { author_id: string | null; blinded_at: string | null } | null;

  if (params.action === "confirm" && !target?.blinded_at) {
    await supabase
      .from(table)
      .update({ blinded_at: new Date().toISOString(), blinded_source: "admin" })
      .eq("id", targetId);
  }
  if (params.action === "dismiss" && target?.blinded_at) {
    await supabase
      .from(table)
      .update({ blinded_at: null, blinded_source: null })
      .eq("id", targetId);
  }

  return { authorId: target?.author_id ?? null };
}

// ── 글/댓글 상태 변경 ────────────────────────────────────────────────────

export async function setPostBlinded(postId: string, blinded: boolean): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_posts")
    .update(
      blinded
        ? { blinded_at: new Date().toISOString(), blinded_source: "admin" }
        : { blinded_at: null, blinded_source: null },
    )
    .eq("id", postId);
  if (error) throw error;
}

export async function setCommentBlinded(commentId: string, blinded: boolean): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_comments")
    .update(
      blinded
        ? { blinded_at: new Date().toISOString(), blinded_source: "admin" }
        : { blinded_at: null, blinded_source: null },
    )
    .eq("id", commentId);
  if (error) throw error;
}

export async function setPostNotice(postId: string, isNotice: boolean): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_posts")
    .update({ is_notice: isNotice })
    .eq("id", postId);
  if (error) throw error;
}

export async function setPostDeleted(postId: string, deleted: boolean): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_posts")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", postId);
  if (error) throw error;
}

/** 댓글 소프트 삭제. 소속 글의 comment_count 도 함께 감소시킨다. */
export async function softDeleteComment(commentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("community_comments")
    .select("post_id, deleted_at")
    .eq("id", commentId)
    .maybeSingle();
  const comment = data as { post_id: string; deleted_at: string | null } | null;
  if (!comment || comment.deleted_at) return;

  const { error } = await supabase
    .from("community_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw error;

  const { data: post } = await supabase
    .from("community_posts")
    .select("comment_count")
    .eq("id", comment.post_id)
    .maybeSingle();
  const count = (post as { comment_count: number } | null)?.comment_count ?? 0;
  await supabase
    .from("community_posts")
    .update({ comment_count: Math.max(0, count - 1) })
    .eq("id", comment.post_id);
}

// ── 목록/설정 ────────────────────────────────────────────────────────────

/** 블라인드 또는 삭제 상태의 글 목록(최근순). */
export async function listModeratedPosts(): Promise<AdminPostSummary[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .or("blinded_at.not.is.null,deleted_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as PostRow[];
  const nicknames = await fetchNicknames(rows.flatMap((r) => (r.author_id ? [r.author_id] : [])));
  return rows.map((row) => mapPost(row, nicknames));
}

/** 최근 글 목록(삭제 제외, 공지 고정/수동 블라인드 조작용). */
export async function listRecentPostsForAdmin(limit = 30): Promise<AdminPostSummary[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .is("deleted_at", null)
    .order("is_notice", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as PostRow[];
  const nicknames = await fetchNicknames(rows.flatMap((r) => (r.author_id ? [r.author_id] : [])));
  return rows.map((row) => mapPost(row, nicknames));
}

/** 스코프별 운영 설정 전체(어드민 설정 폼용). */
export async function listCommunitySettings(): Promise<Record<BoardScope, CommunitySettings>> {
  const fallback: Record<BoardScope, CommunitySettings> = {
    hub: { hotCut: 5, blindReportCount: 3 },
    team: { hotCut: 5, blindReportCount: 3 },
  };

  const { data, error } = await createSupabaseAdminClient()
    .from("community_settings")
    .select("scope, hot_cut, blind_report_count");
  if (error || !data) return fallback;

  for (const row of data as { scope: BoardScope; hot_cut: number; blind_report_count: number }[]) {
    fallback[row.scope] = { hotCut: row.hot_cut, blindReportCount: row.blind_report_count };
  }
  return fallback;
}

export async function updateCommunitySettings(
  scope: BoardScope,
  settings: CommunitySettings,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("community_settings")
    .upsert({
      scope,
      hot_cut: settings.hotCut,
      blind_report_count: settings.blindReportCount,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;

  // 컷을 낮춘 경우에도 다음 리액션을 기다리지 않고, 이미 기준을 충족한 기존 글을
  // 즉시 인기글로 승격한다. 한 번 등재된 글은 기존 정책대로 컷을 올려도 유지한다.
  const { data: candidates, error: candidatesError } = await supabase
    .from("community_posts")
    .select("id, like_count, dislike_count")
    .eq("site_scope", scope)
    .is("hot_at", null)
    .is("blinded_at", null)
    .is("deleted_at", null)
    .or("is_notice.is.null,is_notice.eq.false")
    .gte("like_count", settings.hotCut);
  if (candidatesError) throw candidatesError;

  const qualifyingIds = (candidates ?? [])
    .filter((post) => post.like_count - (post.dislike_count ?? 0) >= settings.hotCut)
    .map((post) => post.id);
  if (qualifyingIds.length === 0) return;

  const { error: promotionError } = await supabase
    .from("community_posts")
    .update({ hot_at: new Date().toISOString() })
    .in("id", qualifyingIds);
  if (promotionError) throw promotionError;
}

export type AdminUserReport = {
  id: string;
  reporterId: string;
  reporterName: string | null;
  targetUserId: string;
  targetUserName: string | null;
  reason: string;
  evidencePostId: string | null;
  evidenceCommentId: string | null;
  createdAt: string;
};

export type AdminCommunitySanction = {
  id: string;
  userId: string;
  userName: string | null;
  reason: string;
  bannedAt: string;
};

export type AdminCommunityGuestSanction = {
  id: string;
  guestKey: string | null;
  nickname: string | null;
  ipLabel: string | null;
  reason: string;
  bannedAt: string;
};

export async function listPendingUserReports(): Promise<AdminUserReport[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("community_user_reports")
    .select("id, reporter_id, target_user_id, reason, evidence_post_id, evidence_comment_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    reporter_id: string;
    target_user_id: string;
    reason: string;
    evidence_post_id: string | null;
    evidence_comment_id: string | null;
    created_at: string;
  }[];
  const nicknames = await fetchNicknames(rows.flatMap((row) => [row.reporter_id, row.target_user_id]));
  return rows.map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: nicknames.get(row.reporter_id) ?? null,
    targetUserId: row.target_user_id,
    targetUserName: nicknames.get(row.target_user_id) ?? null,
    reason: row.reason,
    evidencePostId: row.evidence_post_id,
    evidenceCommentId: row.evidence_comment_id,
    createdAt: row.created_at,
  }));
}

export async function listActiveCommunitySanctions(): Promise<AdminCommunitySanction[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("community_user_sanctions")
    .select("id, user_id, reason, banned_at")
    .is("lifted_at", null)
    .order("banned_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_id: string; reason: string; banned_at: string }[];
  const nicknames = await fetchNicknames(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: nicknames.get(row.user_id) ?? null,
    reason: row.reason,
    bannedAt: row.banned_at,
  }));
}

export async function sanctionCommunityUser(params: {
  userId: string;
  reason: string;
  adminId: string;
  reportId?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("community_user_sanctions").insert({
    user_id: params.userId,
    reason: params.reason,
    banned_by: params.adminId,
  });
  if (error && error.code !== "23505") throw error;

  const reportUpdate = {
    status: "sanctioned",
    resolved_at: new Date().toISOString(),
    resolved_by: params.adminId,
  };
  if (params.reportId) {
    await supabase.from("community_user_reports").update(reportUpdate).eq("id", params.reportId);
  } else {
    await supabase
      .from("community_user_reports")
      .update(reportUpdate)
      .eq("target_user_id", params.userId)
      .eq("status", "pending");
  }
}

export async function dismissCommunityUserReport(reportId: string, adminId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_user_reports")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
    })
    .eq("id", reportId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function liftCommunityUserSanction(sanctionId: string, adminId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_user_sanctions")
    .update({ lifted_at: new Date().toISOString(), lifted_by: adminId })
    .eq("id", sanctionId)
    .is("lifted_at", null);
  if (error) throw error;
}

export async function listActiveCommunityGuestSanctions(): Promise<AdminCommunityGuestSanction[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("community_guest_sanctions")
    .select("id, guest_key, guest_nickname, guest_ip_label, reason, banned_at")
    .is("lifted_at", null)
    .order("banned_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    guest_key: string | null;
    guest_nickname: string | null;
    guest_ip_label: string | null;
    reason: string;
    banned_at: string;
  }[]).map((row) => ({
    id: row.id,
    guestKey: row.guest_key,
    nickname: row.guest_nickname,
    ipLabel: row.guest_ip_label,
    reason: row.reason,
    bannedAt: row.banned_at,
  }));
}

export async function sanctionCommunityGuest(params: {
  postId?: string;
  commentId?: string;
  reason: string;
  adminId: string;
}): Promise<void> {
  const targetId = params.postId ?? params.commentId;
  if (!targetId) throw new Error("제재할 비회원 작성 내역이 필요합니다.");
  const supabase = createSupabaseAdminClient();
  const isPost = Boolean(params.postId);
  const credentialTable = isPost ? "community_guest_post_credentials" : "community_guest_comment_credentials";
  const credentialColumn = isPost ? "post_id" : "comment_id";
  const contentTable = isPost ? "community_posts" : "community_comments";
  const [credentialResult, contentResult] = await Promise.all([
    supabase.from(credentialTable).select("guest_key, ip_key, ip_label").eq(credentialColumn, targetId).maybeSingle(),
    supabase.from(contentTable).select("guest_nickname").eq("id", targetId).maybeSingle(),
  ]);
  if (credentialResult.error) throw credentialResult.error;
  if (contentResult.error) throw contentResult.error;
  const credential = credentialResult.data as { guest_key: string; ip_key: string | null; ip_label: string | null } | null;
  const content = contentResult.data as { guest_nickname: string | null } | null;
  if (!credential) throw new Error("비회원 운영 식별 정보를 찾을 수 없습니다.");
  const { error } = await createSupabaseAdminClient()
    .from("community_guest_sanctions")
    .insert({
      guest_key: credential.guest_key,
      ip_key: credential.ip_key,
      guest_nickname: content?.guest_nickname ?? null,
      guest_ip_label: credential.ip_label,
      reason: params.reason,
      banned_by: params.adminId,
    });
  if (error && error.code !== "23505") throw error;
}

export async function liftCommunityGuestSanction(
  sanctionId: string,
  adminId: string,
): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_guest_sanctions")
    .update({ lifted_at: new Date().toISOString(), lifted_by: adminId })
    .eq("id", sanctionId)
    .is("lifted_at", null);
  if (error) throw error;
}
