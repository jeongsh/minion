"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getGuestIdentity } from "@/lib/community/guest-identity";
import { unlockSupportInquiry, type SupportInquiryDetail } from "@/lib/data/support";
import { submitSupportInquiry } from "@/lib/support/service";

export async function submitSupportInquiryAction(input: {
  contactEmail: string;
  subject: string;
  message: string;
  isPrivate: boolean;
  password: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await getCurrentUser();
  // 로그인하지 않았다면 커뮤니티와 같은 쿠키 기반 비회원 식별자를 발급해, 나중에
  // 로그인 없이도 자기 글을 다시 찾을 수 있게 한다.
  const guestKey = user ? null : (await getGuestIdentity()).key;

  return submitSupportInquiry({ userId: user?.id ?? null, guestKey }, input);
}

export async function unlockSupportInquiryAction(
  id: string,
  password: string,
): Promise<{ ok: true; detail: SupportInquiryDetail } | { ok: false; error: string }> {
  return unlockSupportInquiry(id, password);
}
