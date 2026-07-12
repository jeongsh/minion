"use client";

import Link from "next/link";
import { useState } from "react";

import { renameBracketStageAction } from "./actions";

export type BracketStageTab = {
  id: string;
  name: string;
  split?: string;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-emerald-400">
      <path
        d="M3 8.5L6.5 12L13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0">
      <path
        d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BracketStageTabs({
  segmentKey,
  year,
  split,
  bracketStages,
  activeBracketStageId,
}: {
  segmentKey: string;
  year: number;
  split?: string;
  bracketStages: BracketStageTab[];
  activeBracketStageId: string;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startRename(tab: BracketStageTab) {
    setRenamingId(tab.id);
    setDraft(tab.name);
  }

  async function submitRename(id: string) {
    const trimmed = draft.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    setSaving(true);
    const result = await renameBracketStageAction(segmentKey, id, trimmed);
    setSaving(false);
    setRenamingId(null);
    if (!result.ok) {
      window.alert(result.error);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {bracketStages.map((tab) => {
        const isActive = tab.id === activeBracketStageId;
        const isRenaming = renamingId === tab.id;

        return (
          <div
            key={tab.id}
            className={`flex min-w-[9rem] flex-col gap-0.5 rounded-lg border px-4 py-2 transition-colors ${
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface-muted text-muted hover:border-foreground/30"
            }`}
          >
            <span
              className={`text-[13px] font-medium uppercase tracking-widest ${
                isActive ? "text-background/60" : "text-muted/70"
              }`}
            >
              브래킷 스테이지
            </span>

            {isRenaming ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitRename(tab.id);
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => void submitRename(tab.id)}
                  disabled={saving}
                  className="w-full min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-sm font-black text-foreground"
                />
              </form>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/admin/tournaments?segment=${segmentKey}&year=${year}${
                    tab.split ?? split ? `&split=${encodeURIComponent(tab.split ?? split ?? "")}` : ""
                  }&bracketStageId=${tab.id}`}
                  className={`flex min-w-0 flex-1 items-center gap-1.5 text-sm font-black ${
                    isActive ? "text-background" : "text-foreground"
                  }`}
                >
                  <span className="truncate">{tab.name}</span>
                  {isActive ? <CheckIcon /> : null}
                </Link>
                {isActive ? (
                  <button
                    type="button"
                    onClick={() => startRename(tab)}
                    aria-label="브래킷 스테이지 이름 수정"
                    className="shrink-0 text-background/50 hover:text-background"
                  >
                    <PencilIcon />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
