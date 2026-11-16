"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function MessageIndicator() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading || document.visibilityState !== "visible") return;
      loading = true;
      try {
        const response = await fetch("/api/messages/unread", { cache: "no-store", signal: controller.signal });
        if (!response.ok) { setCount(null); return; }
        const data = await response.json();
        if (typeof data.count === "number") setCount(data.count);
      } catch { if (!controller.signal.aborted) setCount(null); }
      finally { loading = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("minion:messages-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("minion:messages-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return (
    <Link href="/me/messages" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)]" aria-label={`쪽지함${count ? `, 읽지 않은 쪽지 ${count}개` : ""}`}>
      <Mail size={20} />
      {count ? <span aria-hidden className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-0.5 text-[12px] font-medium leading-none text-[var(--accent-foreground)]">{count > 9 ? "9+" : count}</span> : null}
    </Link>
  );
}
