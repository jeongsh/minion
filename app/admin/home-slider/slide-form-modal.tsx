"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeHeroSlide } from "@/lib/types";
import { createHomeHeroSlideAction, updateHomeHeroSlideAction } from "./actions";

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}

function ActiveField({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-foreground">
      <input name="is_active" type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-primary" />
      홈 노출
    </label>
  );
}

// Hero images bypass the Server Action (1MB body cap) and go straight to
// storage, so the original full-quality file is kept.
async function uploadSlideImage(file: File, slideId?: string) {
  const body = new FormData();
  body.set("file", file);
  if (slideId) body.set("slide_id", slideId);

  const response = await fetch("/api/admin/home-slider/upload", { method: "POST", body });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? "이미지 업로드에 실패했습니다.");

  return result.url as string;
}

function preventEnterSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") return;
  const target = event.target;
  if (target instanceof HTMLButtonElement && target.type === "submit") return;
  event.preventDefault();
}

export function SlideFormModal({ mode, slide }: { mode: "create" | "edit"; slide?: HomeHeroSlide }) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(slide?.imageUrl ?? "");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  function handleClose() {
    setOpen(false);
    setPreviewUrl(slide?.imageUrl ?? "");
    setError("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          mode === "create"
            ? "rounded-lg bg-primary px-4 py-2 text-sm font-black text-white transition hover:bg-primary-strong"
            : "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground transition hover:bg-surface-muted"
        }
      >
        {mode === "create" ? "슬라이드 등록" : "수정"}
      </button>

      <dialog
        ref={dialogRef}
        className="modal-native fixed inset-0 m-auto w-[min(100%,40rem)] rounded-2xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
        onClose={handleClose}
      >
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-foreground">
              {mode === "create" ? "슬라이드 등록" : "슬라이드 수정"}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold text-muted transition hover:text-foreground"
            >
              닫기
            </button>
          </div>

          <form
            onKeyDown={preventEnterSubmit}
            action={async (formData) => {
              setError("");
              const imageFile = formData.get("image_file");

              try {
                if (imageFile instanceof File && imageFile.size > 0) {
                  formData.set("image_url", await uploadSlideImage(imageFile, slide?.id));
                }
                formData.delete("image_file");

                if (mode === "create") {
                  await createHomeHeroSlideAction(formData);
                } else {
                  await updateHomeHeroSlideAction(formData);
                }
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "저장에 실패했습니다.");
                return;
              }

              handleClose();
            }}
            className="grid gap-3"
          >
            {mode === "edit" && slide ? (
              <>
                <input type="hidden" name="id" value={slide.id} />
                <input type="hidden" name="image_url" value={slide.imageUrl} />
              </>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="관리 제목"
                name="title"
                defaultValue={slide?.title}
                placeholder="예: T1 우승 하이라이트"
                required
              />
              <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
                슬라이드 이미지
                <input
                  name="image_file"
                  type="file"
                  accept="image/*"
                  required={mode === "create"}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground outline-none transition focus:border-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-[13px] file:font-bold file:text-primary"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setPreviewUrl(URL.createObjectURL(file));
                  }}
                />
                {mode === "edit" ? (
                  <span className="text-[13px] font-semibold text-muted">비워두면 기존 이미지를 유지합니다.</span>
                ) : null}
              </label>
            </div>

            {previewUrl ? (
              <div className="overflow-hidden rounded-xl border border-border bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={slide?.title ?? "미리보기"} className="aspect-[16/7] w-full object-cover" />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[1.7fr_140px_120px] sm:items-end">
              <Field
                label="클릭 링크"
                name="link_url"
                defaultValue={slide?.linkUrl}
                placeholder="/matches/... 또는 https://..."
              />
              <Field label="노출 순서" name="order_index" type="number" defaultValue={slide?.orderIndex ?? 0} />
              <ActiveField defaultChecked={slide?.isActive ?? true} />
            </div>

            {error ? (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-[13px] font-bold text-primary">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-muted transition hover:text-foreground"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white transition hover:bg-primary-strong"
              >
                {mode === "create" ? "등록" : "저장"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
