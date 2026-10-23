"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon, KakaoIcon, NaverIcon } from "@/components/auth/social-provider-icons";
import { INITIAL_PROFILE_STATE } from "@/lib/auth/action-state";
import { linkSocialAccountAction } from "@/lib/auth/link-actions";
import { LINK_PROVIDERS, type LinkProvider } from "@/lib/auth/linked-accounts";

const PROVIDER_ICONS = {
  google: { Icon: GoogleIcon, background: "bg-white" },
  kakao: { Icon: KakaoIcon, background: "bg-[#FEE500]" },
  naver: { Icon: NaverIcon, background: "bg-[#03C75A]" },
};

export function LinkedAccountsForm({ linked, message, error }: { linked: LinkProvider[]; message?: string; error?: string }) {
  const [state, action, pending] = useActionState(linkSocialAccountAction, INITIAL_PROFILE_STATE);
  const feedback = state.message ?? error ?? message;
  const failed = state.status === "error" || (state.status === "idle" && Boolean(error));
  return (
    <div className="mt-6">
      <h4 className="text-[18px] font-bold text-[var(--ui-ink)]">SNS 연동</h4>
      <form action={action} className="mt-2 divide-y divide-[var(--ui-border)]" aria-label="SNS 계정 연동">
        {LINK_PROVIDERS.map(({ value, label }) => {
          const { Icon, background } = PROVIDER_ICONS[value];
          return (
            <div key={value} className="flex min-h-16 items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2.5 text-[16px] font-medium text-[var(--ui-ink)]">
                <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${background}`}><Icon /></span>
                {label}
              </span>
              {linked.includes(value) ? <span className="text-[13px] text-[var(--ui-muted)]">연동됨</span> : (
                <Button type="submit" name="provider" value={value} variant="secondary" disabled={pending} aria-label={`${label} 계정 연동`} className="min-h-11">
                  {pending ? "연동 중..." : "연동하기"}
                </Button>
              )}
            </div>
          );
        })}
      </form>
      {feedback ? <p role={failed ? "alert" : "status"} className={`mt-3 text-[16px] ${failed ? "text-red-600" : "text-[var(--ui-ink)]"}`}>{feedback}</p> : null}
    </div>
  );
}
