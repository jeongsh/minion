"use client";

import { useState } from "react";
import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { Button } from "@/components/ui/button";
import type { Team } from "@/lib/types";
import { createPostAction, updatePostAction } from "./actions";

const BOARD_TYPES = [
  { value: "reviews", label: "경기 리뷰" },
  { value: "draft", label: "밴픽 토론" },
  { value: "issues", label: "LCK 이슈" },
  { value: "free", label: "자유 게시판" },
  { value: "cheer", label: "응원" },
  { value: "players", label: "선수 이야기" },
  { value: "notice", label: "공지" },
];

const SITE_SCOPES = [
  { value: "hub", label: "허브 (전체)" },
  { value: "team", label: "팀 팬페이지" },
];

const INPUT =
  "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent w-full";

type PostInitial = {
  id: string;
  boardType: string;
  siteScope: string;
  teamId?: string;
  title: string;
  content: string;
};

export function PostFormModal({
  mode,
  teams,
  initial,
}: {
  mode: "create" | "edit";
  teams: Team[];
  initial?: PostInitial;
}) {
  const [open, setOpen] = useState(false);


  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          mode === "create"
            ? "rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            : "rounded-md border border-border px-2.5 py-1 text-[13px] font-semibold hover:bg-surface-muted"
        }
      >
        {mode === "create" ? "+ 글 추가" : "수정"}
      </button>

      <ControlledDialog open={open} onClose={handleClose} ariaLabel={mode === "create" ? "글 추가" : "글 수정"} panelClassName="sm:max-w-[34rem]">
        <DialogSheetHeader onClose={handleClose} title={mode === "create" ? "글 추가" : "글 수정"} />
        <div className={dialogBodyClassName}>
                    <form
            action={async (fd) => {
              await (mode === "create" ? createPostAction : updatePostAction)(fd);
              handleClose();
            }}
            className="flex flex-col gap-4"
          >
            {mode === "edit" && (
              <input type="hidden" name="id" value={initial?.id} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  게시판 <span className="text-red-500">*</span>
                </span>
                <select
                  name="board_type"
                  required
                  defaultValue={initial?.boardType ?? ""}
                  className={"minion-native-select " + (INPUT)}
                >
                  <option value="" disabled>— 선택 —</option>
                  {BOARD_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  범위 <span className="text-red-500">*</span>
                </span>
                <select
                  name="site_scope"
                  required
                  defaultValue={initial?.siteScope ?? "hub"}
                  className={"minion-native-select " + (INPUT)}
                >
                  {SITE_SCOPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">팀 (팬페이지 글인 경우)</span>
              <select
                name="team_id"
                defaultValue={initial?.teamId ?? ""}
                className={"minion-native-select " + (INPUT)}
              >
                <option value="">— 없음 (허브 공통) —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                제목 <span className="text-red-500">*</span>
              </span>
              <input
                name="title"
                required
                defaultValue={initial?.title ?? ""}
                placeholder="글 제목을 입력하세요"
                className={INPUT}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                내용 <span className="text-red-500">*</span>
              </span>
              <textarea
                name="content"
                required
                rows={6}
                defaultValue={initial?.content ?? ""}
                placeholder="글 내용을 입력하세요"
                className={`${INPUT} resize-y`}
              />
            </label>

            <Button type="submit" className="mt-1">
              {mode === "create" ? "추가" : "저장"}
            </Button>
          </form>
        </div>
      </ControlledDialog>
    </>
  );
}
