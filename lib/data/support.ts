import "server-only";

import { nicknameFromKey } from "@/lib/community/guest-nickname";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyInquiryPassword } from "@/lib/support/password";

export type SupportInquiryStatus = "open" | "answered" | "closed";
const PAGE_SIZE = 10;

export type SupportBoardItem = {
  id: string;
  subject: string;
  status: SupportInquiryStatus;
  isPrivate: boolean;
  authorLabel: string;
  createdAt: string;
};

export type SupportBoardPage = {
  items: SupportBoardItem[];
  page: number;
  totalPages: number;
  totalCount: number;
};

export type SupportInquiryDetail = {
  id: string;
  // 옛 게시판의 "비밀글"과 같은 정책: 제목은 목록·상세 모두 항상 보이고, 본문(과 답변)만 잠근다.
  subject: string;
  status: SupportInquiryStatus;
  isPrivate: boolean;
  authorLabel: string;
  createdAt: string;
  locked: boolean;
  // locked인데 비밀번호가 없는 경우(로그인 작성자가 비밀번호 없이 쓴 비공개 글)는
  // 작성자 본인 외에는 아무도 열 수 없다 — 화면에서 비밀번호 입력창 대신 안내만 보여준다.
  hasPassword: boolean;
  message: string | null;
  reply: string | null;
  answeredAt: string | null;
};

type InquiryRow = {
  id: string;
  subject: string;
  message: string;
  status: string;
  reply: string | null;
  is_private: boolean;
  password_hash: string | null;
  user_id: string | null;
  guest_key: string | null;
  created_at: string;
  answered_at: string | null;
};

async function resolveAuthorLabels(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  rows: Array<{ user_id: string | null; guest_key: string | null }>,
) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const nicknames = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
    for (const profile of profiles ?? []) nicknames.set(profile.id, profile.nickname);
  }
  // 비회원은 커뮤니티와 같은 방식으로 guest_key에서 결정적으로 생성한 닉네임을 쓴다.
  return (row: { user_id: string | null; guest_key: string | null }) =>
    row.user_id ? (nicknames.get(row.user_id) ?? "회원") : nicknameFromKey(row.guest_key ?? "0");
}

/** 게시판 목록. 비공개 글도 제목·상태는 노출하고 본문만 잠근다. */
export async function listSupportBoard(page: number): Promise<SupportBoardPage> {
  const supabase = createSupabaseAdminClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;

  const { data: rows, count } = await supabase
    .from("support_inquiries")
    .select("id, subject, status, is_private, user_id, guest_key, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const items = rows ?? [];
  const labelFor = await resolveAuthorLabels(supabase, items);
  const totalCount = count ?? 0;

  return {
    items: items.map((row) => ({
      id: row.id,
      subject: row.subject,
      status: row.status as SupportInquiryStatus,
      isPrivate: row.is_private,
      authorLabel: labelFor(row),
      createdAt: row.created_at,
    })),
    page: safePage,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    totalCount,
  };
}

function toDetail(
  row: InquiryRow,
  authorLabel: string,
  locked: boolean,
): SupportInquiryDetail {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status as SupportInquiryStatus,
    isPrivate: row.is_private,
    authorLabel,
    createdAt: row.created_at,
    locked,
    hasPassword: Boolean(row.password_hash),
    message: locked ? null : row.message,
    reply: locked ? null : row.reply,
    answeredAt: locked ? null : row.answered_at,
  };
}

/** 로그인한 작성자 본인은 비밀번호 없이 자기 비공개 글을 본다. 그 외엔 비공개면 잠금 상태로 돌려준다. */
export async function getSupportInquiryDetail(id: string, viewerUserId: string | null): Promise<SupportInquiryDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("support_inquiries")
    .select("id, subject, message, status, reply, is_private, password_hash, user_id, guest_key, created_at, answered_at")
    .eq("id", id)
    .maybeSingle();

  if (!row) return null;

  const isOwner = Boolean(viewerUserId) && row.user_id === viewerUserId;
  const locked = row.is_private && !isOwner;
  const labelFor = await resolveAuthorLabels(supabase, [row]);
  return toDetail(row, labelFor(row), locked);
}

const UNLOCK_MAX_ATTEMPTS = 8;
const UNLOCK_LOCK_MINUTES = 10;

function minutesUntil(value: string): number {
  return Math.max(1, Math.ceil((new Date(value).getTime() - Date.now()) / 60_000));
}

/**
 * 비공개 글 비밀번호 확인. 비밀번호가 최소 4자라 시도 제한이 없으면 그냥 뚫린다 —
 * 틀린 시도가 쌓이면 register_support_unlock_attempt가 일정 시간 이 글의 잠금 해제
 * 자체를 막는다(원자적 카운터라 동시 요청으로 우회할 수 없다).
 */
export async function unlockSupportInquiry(id: string, password: string): Promise<{ ok: true; detail: SupportInquiryDetail } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("support_inquiries")
    .select("id, subject, message, status, reply, is_private, password_hash, user_id, guest_key, created_at, answered_at, unlock_locked_until")
    .eq("id", id)
    .maybeSingle();

  if (!row) return { ok: false, error: "문의를 찾을 수 없어요." };
  if (!row.is_private) return { ok: false, error: "비공개 글이 아니에요." };
  if (!row.password_hash) return { ok: false, error: "비밀번호가 설정되지 않은 글이에요. 작성자만 볼 수 있어요." };
  if (row.unlock_locked_until && new Date(row.unlock_locked_until) > new Date()) {
    return { ok: false, error: `너무 많이 틀렸어요. ${minutesUntil(row.unlock_locked_until)}분 후 다시 시도해주세요.` };
  }

  const success = verifyInquiryPassword(password, row.password_hash);
  const { data: attempts } = await supabase.rpc("register_support_unlock_attempt", {
    p_inquiry_id: id,
    p_success: success,
    p_max_attempts: UNLOCK_MAX_ATTEMPTS,
    p_lock_minutes: UNLOCK_LOCK_MINUTES,
  });
  const attempt = attempts?.[0];

  if (!success) {
    if (attempt?.locked_until) {
      return { ok: false, error: `비밀번호를 너무 많이 틀렸어요. ${minutesUntil(attempt.locked_until)}분 후 다시 시도해주세요.` };
    }
    return { ok: false, error: "비밀번호가 일치하지 않아요." };
  }

  const labelFor = await resolveAuthorLabels(supabase, [row]);
  return { ok: true, detail: toDetail(row, labelFor(row), false) };
}
