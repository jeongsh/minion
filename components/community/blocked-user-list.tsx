"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { RankAvatar } from "@/components/rank/rank-avatar";
import { useToast } from "@/components/ui/toast";
import { setCommunityUserBlockedAction } from "@/lib/community/user-actions";
import type { CommunityUserSummary } from "@/lib/data/community-users";

export function BlockedUserList({ users }: { users: CommunityUserSummary[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  if (users.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--ui-muted)]">차단한 사용자가 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--ui-border)]">
      {users.map((user) => (
        <li key={user.id} className="flex items-center gap-3 py-3">
          <RankAvatar tier={user.tier} src={user.profileImageUrl} alt={user.nickname} fallback={user.nickname.charAt(0)} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ui-ink)]">{user.nickname}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await setCommunityUserBlockedAction({ targetUserId: user.id, blocked: false });
              showToast({ title: result.ok ? "차단 해제" : "해제 실패", description: result.ok ? result.message : result.error, tone: result.ok ? "success" : "error" });
              if (result.ok) router.refresh();
            })}
            className="rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
          >
            차단 해제
          </button>
        </li>
      ))}
    </ul>
  );
}
