import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasEmailPassword } from "@/lib/auth/linked-accounts";

type NaverAccount = { id: string; email: string; nickname?: string };

/** Called only after validating Naver's OAuth state and fetching its userinfo. */
export async function resolveNaverAccount(naver: NaverAccount, targetUserId?: string): Promise<User> {
  const admin = createSupabaseAdminClient();
  const fail = () => new Error("네이버 계정을 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
  const { data: linked, error: lookupError } = await admin.from("profiles")
    .select("id").eq("naver_id", naver.id).maybeSingle();
  if (lookupError) throw fail();
  if (targetUserId && linked && linked.id !== targetUserId) {
    throw new Error("이미 다른 MINION 계정에 연결된 네이버 계정입니다.");
  }

  let user: User;
  if (targetUserId || linked) {
    const result = await admin.auth.admin.getUserById(targetUserId ?? linked!.id);
    if (result.error || !result.data.user) throw fail();
    user = result.data.user;
    if (!targetUserId) {
      // profiles is user-editable. It is only a lookup index, never proof of ownership.
      const trustedId = user.app_metadata.naver_id;
      const confirmedEmailOwner = trustedId === undefined
        && user.email_confirmed_at
        && user.email?.toLowerCase() === naver.email.toLowerCase();
      if (trustedId !== naver.id && !confirmedEmailOwner) throw fail();
    }
  } else {
    const created = await admin.auth.admin.createUser({
      email: naver.email,
      email_confirm: true,
      app_metadata: { provider: "custom:naver", providers: ["custom:naver"], naver_login_only: true },
      user_metadata: { nickname: naver.nickname },
    });
    if (created.error) {
      if (created.error.code !== "email_exists" && !/already.*(registered|exists)/i.test(created.error.message)) throw fail();
      // Admin generateLink resolves an existing email without sending mail. Only a
      // confirmed account can receive an automatic link; unconfirmed signups are rejected.
      const existing = await admin.auth.admin.generateLink({ type: "magiclink", email: naver.email });
      if (existing.error || !existing.data.user?.email_confirmed_at
        || existing.data.user.email?.toLowerCase() !== naver.email.toLowerCase()) {
        throw new Error("기존 이메일 계정의 이메일 인증을 완료한 뒤 네이버로 로그인해주세요.");
      }
      user = existing.data.user;
    } else {
      if (!created.data.user) throw fail();
      user = created.data.user;
    }
  }

  if (user.app_metadata.naver_id && user.app_metadata.naver_id !== naver.id) {
    throw new Error("이미 다른 네이버 계정이 연결되어 있습니다.");
  }
  const profile = await admin.from("profiles").select("naver_id").eq("id", user.id).single();
  if (profile.error) throw fail();
  if (profile.data.naver_id && profile.data.naver_id !== naver.id) {
    throw new Error("이미 다른 네이버 계정이 연결되어 있습니다.");
  }
  // Compare-and-set plus the existing unique index prevents stealing/replacing a binding.
  const update = admin.from("profiles").update({ naver_id: naver.id }).eq("id", user.id);
  const saved = await (profile.data.naver_id ? update.eq("naver_id", naver.id) : update.is("naver_id", null))
    .select("id").maybeSingle();
  if (saved.error || !saved.data) throw new Error("이미 연결된 네이버 계정이 있는지 확인한 뒤 다시 시도해주세요.");
  const result = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { naver_id: naver.id, naver_login_only: !hasEmailPassword(user) },
  });
  if (result.error || !result.data.user) {
    // A failed metadata write must not strand a newly reserved, different-email link.
    if (!profile.data.naver_id) {
      const rollback = await admin.from("profiles").update({ naver_id: null })
        .eq("id", user.id).eq("naver_id", naver.id);
      if (rollback.error) console.error("네이버 연동 예약 해제 실패", { userId: user.id, code: rollback.error.code });
    }
    throw fail();
  }
  return result.data.user;
}
