"use client";

import { useEffect, useState } from "react";

import { getGuestNicknameAction } from "@/lib/community/actions";

export function GuestIdentityFields({ compact = false }: { compact?: boolean }) {
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getGuestNicknameAction().then((result) => {
      if (active && result.ok) setNickname(result.nickname);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 font-bold text-[var(--ui-ink)] ${compact ? "h-9 text-[13px]" : "h-10 text-sm"}`}
      aria-label="비회원 닉네임"
    >
      {nickname ?? <span className="h-3.5 w-24 animate-pulse rounded bg-[var(--ui-border)]" aria-hidden />}
    </div>
  );
}
