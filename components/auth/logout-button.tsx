"use client";

import { signOutAction } from "@/lib/auth/actions";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={className ?? "text-sm font-bold text-[var(--muted)] hover:underline"}
      >
        로그아웃
      </button>
    </form>
  );
}
