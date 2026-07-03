"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { teams as allTeams } from "@/lib/team-themes";
import type { Team } from "@/lib/types";

// 팀 전환 시 유지할 수 있는 1뎁스 탭. 더 깊은 경로(글 상세 등)는 팀 간 호환되지 않으므로 버린다.
const SWITCHABLE_TABS = new Set(["matches", "players", "community", "instagram", "videos"]);

export function TeamSwitcher({ team, pathname }: { team?: Team; pathname: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const currentTab = team ? pathname.split("/")[3] : undefined;
  const tabSuffix = currentTab && SWITCHABLE_TABS.has(currentTab) ? `/${currentTab}` : "";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={team ? `현재 ${team.name} 팬페이지, 팀 전환` : "팬사이트 이동"}
        className="flex items-center gap-2 rounded-full border border-[#e8eaf0] bg-[#f8f9fb] py-1 pl-1.5 pr-2.5 transition hover:border-[#cfd4df]"
      >
        {team?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="h-7 w-7 rounded-full bg-white object-contain p-1" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-accent" />
        )}
        <span className="text-sm font-black text-[#111827]">{team?.shortName ?? "팬사이트"}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 text-[#98a2b3] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="팀 팬페이지 이동"
          className="absolute left-0 top-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-[#e8eaf0] bg-white p-2 shadow-xl shadow-black/10"
        >
          <div className="max-h-[60vh] overflow-y-auto">
            <Link
              role="menuitem"
              href="/"
              onClick={() => setOpen(false)}
              aria-current={!team && pathname === "/" ? "page" : undefined}
              className={`mb-1 flex items-center rounded-xl px-2.5 py-2 text-sm font-bold transition ${
                !team && pathname === "/" ? "bg-[#f4f5f8] text-[#111827]" : "text-[#667085] hover:bg-[#f8f9fb] hover:text-[#111827]"
              }`}
            >
              MINION 홈
            </Link>
            <div className="mb-1 border-t border-[#f0f2f5]" />
            {allTeams.map((item) => {
              const isCurrent = item.id === team?.id;
              return (
                <Link
                  key={item.id}
                  role="menuitem"
                  href={`/fan/${item.fanSiteHost}${tabSuffix}`}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
                    isCurrent ? "bg-[#f4f5f8]" : "hover:bg-[#f8f9fb]"
                  }`}
                >
                  {item.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.logoUrl} alt="" className="h-7 w-7 rounded-full bg-white object-contain p-0.5" />
                  ) : null}
                  <span className="text-sm font-bold text-[#111827]">{item.shortName}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-[#98a2b3]">{item.name}</span>
                  {isCurrent ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
