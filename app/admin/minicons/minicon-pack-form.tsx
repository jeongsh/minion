"use client";

import { useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import {
  MINICON_MAX_PACK_ITEMS,
  MINICON_MIN_PACK_ITEMS,
} from "@/lib/minicons/upload-security";
import { createMiniconPackAction } from "./actions";

type UploadedMinicon = {
  name: string;
  path: string;
  mimeType: string;
  byteSize: number;
};

function itemName(fileName: string, index: number) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return withoutExtension.slice(0, 20) || `미니콘 ${index + 1}`;
}

async function uploadMinicon(file: File, index: number): Promise<UploadedMinicon> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/admin/minicons/upload", { method: "POST", body: formData });
  const result = await response.json() as { error?: string; path?: string; mimeType?: string; byteSize?: number };
  if (!response.ok || !result.path || !result.mimeType || !result.byteSize) {
    throw new Error(result.error ?? `${file.name} 업로드에 실패했습니다.`);
  }
  return { name: itemName(file.name, index), path: result.path, mimeType: result.mimeType, byteSize: result.byteSize };
}

export function MiniconPackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = Array.from((form.elements.namedItem("items") as HTMLInputElement).files ?? []);
    if (files.length < MINICON_MIN_PACK_ITEMS || files.length > MINICON_MAX_PACK_ITEMS) {
      showToast({ title: "등록할 수 없어요", description: `200×200 미니콘을 ${MINICON_MIN_PACK_ITEMS}~${MINICON_MAX_PACK_ITEMS}개 선택하세요.`, tone: "error" });
      return;
    }

    setPending(true);
    setProgress(0);
    try {
      const uploaded: UploadedMinicon[] = [];
      for (let start = 0; start < files.length; start += 4) {
        const batch = files.slice(start, start + 4);
        const results = await Promise.all(batch.map((file, offset) => uploadMinicon(file, start + offset)));
        uploaded.push(...results);
        setProgress(uploaded.length);
      }

      const result = await createMiniconPackAction({
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
        rightsConfirmed: data.get("rights") === "on",
        items: uploaded,
      });
      showToast({
        title: result.ok ? "미니콘 공개 완료" : "등록 실패",
        description: result.ok ? result.message : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) {
        formRef.current?.reset();
        setFileNames([]);
        setProgress(0);
      }
    } catch (error) {
      showToast({ title: "업로드 실패", description: error instanceof Error ? error.message : "파일을 업로드하지 못했습니다.", tone: "error" });
    } finally {
      setPending(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-5 rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-[14px] font-medium text-[var(--ui-text)]">
          패키지 이름
          <input name="name" required maxLength={30} placeholder="예: 미니언 반응 모음" className="h-11 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 text-[16px] font-normal outline-none focus:border-[var(--tp)]" />
        </label>
        <label className="grid gap-2 text-[14px] font-medium text-[var(--ui-text)]">
          설명
          <input name="description" maxLength={300} placeholder="패키지를 소개해 주세요." className="h-11 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 text-[16px] font-normal outline-none focus:border-[var(--tp)]" />
        </label>
      </div>

      <label className="grid gap-2 text-[14px] font-medium text-[var(--ui-text)]">
        미니콘 파일
        <input
          name="items"
          type="file"
          required
          multiple
          accept="image/png,image/jpeg,image/gif"
          onChange={(event) => setFileNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
          className="min-h-12 rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-3 text-[14px] font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--ui-ink)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--ui-surface)]"
        />
        <span className="text-[13px] font-normal leading-5 text-[var(--ui-muted)]">정확히 200×200px, JPG·PNG·GIF, 개당 2MB 이하 · 한 번에 10~50개</span>
      </label>

      {fileNames.length > 0 ? (
        <div className="rounded-xl bg-[var(--ui-surface-muted)] p-3">
          <p className="text-[14px] font-medium text-[var(--ui-ink)]">선택한 파일 {fileNames.length}개</p>
          <p className="mt-1 truncate text-[13px] font-normal text-[var(--ui-muted)]">{fileNames.slice(0, 8).join(", ")}{fileNames.length > 8 ? ` 외 ${fileNames.length - 8}개` : ""}</p>
        </div>
      ) : null}

      <label className="flex items-start gap-3 rounded-xl border border-[var(--ui-border)] p-4 text-[16px] font-normal leading-6 text-[var(--ui-text)]">
        <input name="rights" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--tp)]" />
        <span>본인이 제작했거나 등록·배포 권한을 보유한 이미지만 업로드하며, 저작권·상표권·초상권 침해 시 이용이 중지될 수 있음을 확인합니다.</span>
      </label>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-normal text-[var(--ui-muted)]">대표 이미지는 첫 번째 미니콘으로 자동 설정됩니다.</p>
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-4 text-[14px] font-medium text-[var(--ui-surface)] disabled:opacity-50">
          {pending ? `업로드 중 ${progress}/${fileNames.length}` : "미니콘 공개"}
        </button>
      </div>
    </form>
  );
}
