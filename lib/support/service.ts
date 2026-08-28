import "server-only";

// 고객센터 문의 접수의 공통 로직. 웹 서버 액션과 앱 API 라우트가 신원 확인(쿠키 vs
// 설치 ID)만 다르게 하고, 검증·스팸 방지·저장은 이 모듈 하나로 통일해서 쓴다.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashInquiryPassword } from "@/lib/support/password";

const SUBJECT_MAX = 100;
const MESSAGE_MAX = 2000;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 32;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export type SupportInquiryIdentity = { userId: string | null; guestKey: string | null };

export type SupportInquirySubmission = {
  contactEmail: string;
  subject: string;
  message: string;
  isPrivate: boolean;
  password: string;
};

export async function submitSupportInquiry(
  identity: SupportInquiryIdentity,
  input: SupportInquirySubmission,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const contactEmail = input.contactEmail.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();
  const password = input.password.trim();

  // 비회원은 guest_key(쿠키/설치 ID)를 잃어버리면 문의내역을 다시 찾을 방법이 없으므로,
  // 이메일만은 예외적으로 필수로 받아 최소한의 연락 수단을 확보한다. 로그인 사용자는
  // 계정에 문의가 계속 묶여 있어 선택으로 둔다.
  if (!identity.userId && !contactEmail) {
    return { ok: false, error: "비회원은 답변을 받을 이메일이 필요해요." };
  }
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    return { ok: false, error: "올바른 이메일 주소를 입력해주세요." };
  }
  if (!subject || subject.length > SUBJECT_MAX) {
    return { ok: false, error: `제목은 1자 이상 ${SUBJECT_MAX}자 이하로 입력해주세요.` };
  }
  if (!message || message.length > MESSAGE_MAX) {
    return { ok: false, error: `내용은 1자 이상 ${MESSAGE_MAX}자 이하로 입력해주세요.` };
  }
  // 로그인 작성자는 비공개 글을 볼 때 계정(user_id)만으로 자동 통과하므로 비밀번호를
  // 아예 받지 않는다(선택도 아님 — 항상 무시하고 null로 저장한다). 비회원은 계정이
  // 없어 비밀번호가 유일한 잠금 수단이라 필수로 받는다.
  if (input.isPrivate && !identity.userId) {
    if (!password) {
      return { ok: false, error: "비공개 글은 비밀번호가 필요해요." };
    }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return { ok: false, error: `비밀번호는 ${PASSWORD_MIN}자 이상 ${PASSWORD_MAX}자 이하로 입력해주세요.` };
    }
  }
  if (!identity.userId && !identity.guestKey) {
    return { ok: false, error: "문의자를 확인하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  // guest_key는 쿠키/설치 ID라 비회원이 쿠키를 지우거나 앱을 재설치하면 바로 새로 발급된다.
  // 그것만으로 스팸을 막으면 우회가 너무 쉬우니, 비회원이 입력한 이메일도 같이 확인한다
  // (idx_support_inquiries_contact_email이 이 조회를 위한 인덱스다).
  const [{ count: identityCount }, { count: emailCount }] = await Promise.all([
    supabase
      .from("support_inquiries")
      .select("id", { count: "exact", head: true })
      .eq(identity.userId ? "user_id" : "guest_key", identity.userId ?? identity.guestKey)
      .gte("created_at", since),
    !identity.userId && contactEmail
      ? supabase
          .from("support_inquiries")
          .select("id", { count: "exact", head: true })
          .eq("contact_email", contactEmail)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);

  if ((identityCount ?? 0) >= RATE_LIMIT_MAX || (emailCount ?? 0) >= RATE_LIMIT_MAX) {
    return { ok: false, error: "문의를 너무 많이 보냈어요. 잠시 후 다시 시도해주세요." };
  }

  const { data, error } = await supabase
    .from("support_inquiries")
    .insert({
      user_id: identity.userId,
      guest_key: identity.userId ? null : identity.guestKey,
      contact_email: contactEmail || null,
      subject,
      message,
      is_private: input.isPrivate,
      password_hash: input.isPrivate && !identity.userId && password ? hashInquiryPassword(password) : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "문의 접수에 실패했어요. 잠시 후 다시 시도해주세요." };
  }

  return { ok: true, id: data.id };
}
