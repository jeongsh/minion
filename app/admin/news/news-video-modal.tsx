"use client";

import { useEffect, useRef, useState } from "react";
import type { Team } from "@/lib/types";
import { createVideoAction, updateVideoAction } from "./actions";

const PLATFORMS = ["youtube", "twitch", "afreecatv", "naver"] as const;

const INPUT =
  "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent w-full";

type VideoInitial = {
  id: string;
  teamId: string;
  platform: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  viewCount: number;
};

export function VideoFormModal({
  mode,
  teams,
  initial,
}: {
  mode: "create" | "edit";
  teams: Team[];
  initial?: VideoInitial;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  function handleClose() {
    setOpen(false);
  }

  const publishedAtValue = initial?.publishedAt
    ? new Date(initial.publishedAt).toISOString().slice(0, 16)
    : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          mode === "create"
            ? "rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            : "rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface-muted"
        }
      >
        {mode === "create" ? "+ 영상 추가" : "수정"}
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-[min(100%,34rem)] rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
        onClose={handleClose}
      >
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{mode === "create" ? "영상 추가" : "영상 수정"}</h3>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
            >
              닫기
            </button>
          </div>

          <form
            action={async (fd) => {
              await (mode === "create" ? createVideoAction : updateVideoAction)(fd);
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
                  팀 <span className="text-red-500">*</span>
                </span>
                <select
                  name="team_id"
                  required
                  defaultValue={initial?.teamId ?? ""}
                  className={INPUT}
                >
                  <option value="" disabled>— 선택 —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  플랫폼 <span className="text-red-500">*</span>
                </span>
                <select
                  name="platform"
                  required
                  defaultValue={initial?.platform ?? "youtube"}
                  className={INPUT}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                제목 <span className="text-red-500">*</span>
              </span>
              <input
                name="title"
                required
                defaultValue={initial?.title ?? ""}
                placeholder="예) [SKT T1] Faker 경기 하이라이트"
                className={INPUT}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                영상 URL <span className="text-red-500">*</span>
              </span>
              <input
                name="video_url"
                required
                type="url"
                defaultValue={initial?.videoUrl ?? ""}
                placeholder="https://www.youtube.com/watch?v=..."
                className={INPUT}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">썸네일 URL</span>
              <input
                name="thumbnail_url"
                type="url"
                defaultValue={initial?.thumbnailUrl ?? ""}
                placeholder="비워두면 YouTube 썸네일 자동 적용"
                className={INPUT}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">게시일</span>
                <input
                  name="published_at"
                  type="datetime-local"
                  defaultValue={publishedAtValue}
                  className={INPUT}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">조회수</span>
                <input
                  name="view_count"
                  type="number"
                  min={0}
                  defaultValue={initial?.viewCount ?? 0}
                  className={INPUT}
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-1 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              {mode === "create" ? "추가" : "저장"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
