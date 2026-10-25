"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { RankAvatar } from "@/components/rank/rank-avatar";
import { useToast } from "@/components/ui/toast";
import { setCommunityGuestBlockedAction, setCommunityUserBlockedAction } from "@/lib/community/user-actions";
import type { CommunityUserSummary } from "@/lib/data/community-users";
import type { BlockedCommunityGuest } from "@/lib/data/community-guests";

export function BlockedUserList({ users, guests = [] }: { users: CommunityUserSummary[]; guests?: BlockedCommunityGuest[] }) {
  const inFlight = useRef(new Set<string>());
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const sourceKey = JSON.stringify([users.map(user => user.id), guests.map(guest => guest.guestKey)]);
  const [serverKey, setServerKey] = useState(sourceKey);
  if (serverKey !== sourceKey) {
    setServerKey(sourceKey);
    setRemoved(previous => new Set([...previous].filter(key => inFlight.current.has(key))));
  }
  const visibleUsers = users.filter(user => !removed.has(`user:${user.id}`));
  const visibleGuests = guests.filter(guest => !removed.has(`guest:${guest.guestKey}`));
  const router = useRouter();
  const { showToast } = useToast();

  const unblock = async (key: string, task: () => ReturnType<typeof setCommunityUserBlockedAction>) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setRemoved(previous => new Set(previous).add(key));
    try {
      const result = await task();
      if (!result.ok) throw new Error(result.error);
      showToast({ title: "차단 해제", description: result.message, tone: "success" });
      router.refresh();
    } catch (error) {
      setRemoved(previous => { const next = new Set(previous); next.delete(key); return next; });
      showToast({ title: "해제 실패", description: error instanceof Error ? error.message : "다시 시도해 주세요.", tone: "error" });
    } finally { inFlight.current.delete(key); }
  };

  if (visibleUsers.length === 0 && visibleGuests.length === 0) {
    return <p className="py-5 text-center text-[13px] text-[var(--ui-muted)] sm:py-8 sm:text-sm">차단한 사용자가 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--ui-border)]">
      {visibleUsers.map((user) => (
        <li key={user.id} className="flex items-center gap-3 py-3">
          <RankAvatar tier={user.tier} src={user.profileImageUrl} alt={user.nickname} fallback={user.nickname.charAt(0)} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ui-ink)]">{user.nickname}</span>
          <button
            type="button"
            onClick={() => void unblock(`user:${user.id}`, () => setCommunityUserBlockedAction({ targetUserId: user.id, blocked: false }))}
            className="rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
          >
            차단 해제
          </button>
        </li>
      ))}
      {visibleGuests.map((guest) => (
        <li key={guest.guestKey} className="flex items-center gap-3 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[12px] font-medium text-[var(--ui-muted)]">G</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ui-ink)]">{guest.nickname}</span>
          <button
            type="button"
            onClick={() => void unblock(`guest:${guest.guestKey}`, () => setCommunityGuestBlockedAction({ blocked: false, guestKey: guest.guestKey, guestNickname: guest.nickname }))}
            className="rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
          >
            차단 해제
          </button>
        </li>
      ))}
    </ul>
  );
}
