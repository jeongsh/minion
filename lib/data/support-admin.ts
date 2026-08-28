import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupportInquiryStatus = "open" | "answered" | "closed";

export type AdminSupportInquiry = {
  id: string;
  userId: string | null;
  contactEmail: string | null;
  subject: string;
  message: string;
  status: SupportInquiryStatus;
  adminNote: string | null;
  reply: string | null;
  isPrivate: boolean;
  createdAt: string;
  answeredAt: string | null;
  authorNickname: string | null;
};

/** 어드민 진입점(전역 네비게이션 배지)에서 쓰는 가벼운 미처리 건수 조회. */
export async function countOpenSupportInquiries(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("support_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}

const SUPPORT_INQUIRY_COLUMNS = "id, user_id, contact_email, subject, message, status, admin_note, reply, is_private, created_at, answered_at";

export async function listSupportInquiries(): Promise<AdminSupportInquiry[]> {
  const supabase = createSupabaseAdminClient();

  // 미처리 큐는 절대 잘리면 안 되니 전부 가져오고(보통 소수), 처리된 건만 최근 200개로
  // 제한한다. created_at desc로만 자르면 오래 방치된 미처리 문의가 목록 밖으로 밀려나
  // 어드민 화면에서 아예 사라져 버린다.
  const [{ data: openRows }, { data: recentRows }] = await Promise.all([
    supabase
      .from("support_inquiries")
      .select(SUPPORT_INQUIRY_COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("support_inquiries")
      .select(SUPPORT_INQUIRY_COLUMNS)
      .neq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const inquiries = [...(openRows ?? []), ...(recentRows ?? [])];

  const nicknames = new Map<string, string | null>();
  const userIds = [...new Set(inquiries.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
    for (const profile of profiles ?? []) nicknames.set(profile.id, profile.nickname);
  }

  return inquiries.map((row) => ({
    id: row.id,
    userId: row.user_id,
    contactEmail: row.contact_email,
    subject: row.subject,
    message: row.message,
    status: row.status as SupportInquiryStatus,
    adminNote: row.admin_note,
    reply: row.reply,
    isPrivate: row.is_private,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
    authorNickname: row.user_id ? (nicknames.get(row.user_id) ?? null) : null,
  }));
}
