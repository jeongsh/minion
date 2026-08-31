"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import {
  MINICON_MAX_BYTES,
  MINICON_MAX_PACK_ITEMS,
  MINICON_MIN_PACK_ITEMS,
} from "@/lib/minicons/upload-security";
import {
  cleanupMiniconUploadsAction,
  submitMiniconApplicationAction,
  type UploadedMinicon,
} from "./actions";

const MAX_PENDING_APPLICATIONS = 3;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);

function textLength(value: string) {
  return Array.from(value).length;
}

function itemName(fileName: string, index: number) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return Array.from(withoutExtension).slice(0, 20).join("") || `미니콘 ${index + 1}`;
}

async function uploadMinicon(file: File, index: number): Promise<UploadedMinicon> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/minicons/upload", { method: "POST", body: formData });
  const result = await response.json().catch(() => ({})) as {
    error?: string;
    receiptId?: string;
  };

  if (!response.ok || !result.receiptId) {
    throw new Error(result.error ?? `${file.name} 업로드에 실패했습니다.`);
  }

  return {
    name: itemName(file.name, index),
    receiptId: result.receiptId,
  };
}

export function MiniconSubmissionForm({ pendingApplicationCount }: { pendingApplicationCount: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const isAtLimit = pendingApplicationCount >= MAX_PENDING_APPLICATIONS;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    if (isAtLimit) {
      showToast({
        title: "신청 대기 한도",
        description: "검토 중인 신청이 끝난 뒤 새 미니콘을 신청할 수 있습니다.",
        tone: "info",
      });
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const rightsConfirmed = data.get("rights") === "on";
    const files = Array.from((form.elements.namedItem("items") as HTMLInputElement).files ?? []);

    if (textLength(name) < 1 || textLength(name) > 30) {
      showToast({ title: "신청할 수 없어요", description: "패키지 이름은 1~30자로 입력하세요.", tone: "error" });
      return;
    }
    if (textLength(description) > 300) {
      showToast({ title: "신청할 수 없어요", description: "설명은 300자까지 입력할 수 있습니다.", tone: "error" });
      return;
    }
    if (!rightsConfirmed) {
      showToast({ title: "권리 확인이 필요해요", description: "등록·배포할 권리가 있는 이미지인지 확인해 주세요.", tone: "error" });
      return;
    }
    if (files.length < MINICON_MIN_PACK_ITEMS || files.length > MINICON_MAX_PACK_ITEMS) {
      showToast({
        title: "신청할 수 없어요",
        description: `200×200 미니콘을 ${MINICON_MIN_PACK_ITEMS}~${MINICON_MAX_PACK_ITEMS}개 선택하세요.`,
        tone: "error",
      });
      return;
    }

    const invalidFile = files.find((file) => (
      file.size <= 0
      || file.size > MINICON_MAX_BYTES
      || (file.type !== "" && !ALLOWED_TYPES.has(file.type))
    ));
    if (invalidFile) {
      showToast({
        title: "파일을 확인해 주세요",
        description: `${invalidFile.name}: JPG·PNG·GIF 형식, 파일당 2MB 이하만 등록할 수 있습니다.`,
        tone: "error",
      });
      return;
    }

    setPending(true);
    setProgress(0);
    const uploaded: UploadedMinicon[] = [];

    try {
      for (let start = 0; start < files.length; start += 4) {
        const batch = files.slice(start, start + 4);
        const results = await Promise.allSettled(
          batch.map((file, offset) => uploadMinicon(file, start + offset)),
        );

        for (const result of results) {
          if (result.status === "fulfilled") uploaded.push(result.value);
        }
        setProgress(uploaded.length);

        const rejected = results.find((result) => result.status === "rejected");
        if (rejected?.status === "rejected") throw rejected.reason;
      }

      const result = await submitMiniconApplicationAction({
        name,
        description,
        rightsConfirmed,
        items: uploaded,
      });

      if (!result.ok) {
        await cleanupMiniconUploadsAction(uploaded.map((item) => item.receiptId)).catch(() => undefined);
        showToast({ title: "신청하지 못했어요", description: result.error, tone: "error" });
        return;
      }

      showToast({ title: "검토 신청 완료", description: result.message, tone: "success" });
      formRef.current?.reset();
      setFileNames([]);
      setProgress(0);
      router.refresh();
    } catch (error) {
      await cleanupMiniconUploadsAction(uploaded.map((item) => item.receiptId)).catch(() => undefined);
      showToast({
        title: "업로드하지 못했어요",
        description: error instanceof Error ? error.message : "미니콘 파일을 업로드하지 못했습니다.",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="grid gap-4 rounded-lg bg-[var(--ui-surface)] p-3 sm:p-4"
    >
      <label className="grid gap-2 text-[14px] font-medium text-[var(--ui-text)]">
        패키지 이름
        <input
          name="name"
          required
          maxLength={30}
          disabled={pending}
          placeholder="예: 우리 팀 승리 요정"
          className="h-11 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 text-[16px] font-normal outline-none transition focus:border-[var(--tp)] disabled:opacity-60"
        />
      </label>

      <label className="grid gap-2 text-[14px] font-medium text-[var(--ui-text)]">
        패키지 설명
        <textarea
          name="description"
          maxLength={300}
          rows={3}
          disabled={pending}
          placeholder="미니콘의 캐릭터와 콘셉트를 소개해 주세요."
          className="resize-y rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-[16px] font-normal leading-6 outline-none transition focus:border-[var(--tp)] disabled:opacity-60"
        />
      </label>

      <label className="grid gap-2 text-[14px] font-medium text-[var(--ui-text)]">
        미니콘 파일
        <input
          name="items"
          type="file"
          required
          multiple
          disabled={pending}
          accept="image/png,image/jpeg,image/gif"
          onChange={(event) => setFileNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
          className="min-h-12 rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-3 text-[14px] font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--ui-ink)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--ui-surface)] disabled:opacity-60"
        />
        <span className="text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
          200×200px · JPG·PNG·GIF · 개당 2MB 이하 · 10~50개 · 첫 파일이 대표 이미지
        </span>
      </label>

      {fileNames.length > 0 ? (
        <div className="rounded-xl bg-[var(--ui-surface-muted)] p-3" aria-live="polite">
          <p className="text-[14px] font-medium text-[var(--ui-ink)]">선택한 파일 {fileNames.length}개</p>
          <p className="mt-1 truncate text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
            {fileNames.slice(0, 8).join(", ")}{fileNames.length > 8 ? ` 외 ${fileNames.length - 8}개` : ""}
          </p>
        </div>
      ) : null}

      <label className="flex items-start gap-3 rounded-xl border border-[var(--ui-border)] p-4 text-[16px] font-normal leading-6 text-[var(--ui-text)]">
        <input name="rights" type="checkbox" required disabled={pending} className="mt-1 h-4 w-4 shrink-0 accent-[var(--tp)]" />
        <span>
          본인이 제작했거나 등록·배포 권한을 보유한 이미지만 신청하며, 저작권·상표권·초상권 침해 시 반려되거나 이용이 중지될 수 있음을 확인합니다.
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
          검토 중 {pendingApplicationCount}/{MAX_PENDING_APPLICATIONS}건
        </p>
        <button
          type="submit"
          disabled={pending || isAtLimit}
          className="h-10 shrink-0 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-5 text-[14px] font-medium text-[var(--ui-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? `업로드 중 ${progress}/${fileNames.length}`
            : isAtLimit
              ? "검토 대기 한도 도달"
              : "미니콘 검토 신청"}
        </button>
      </div>
    </form>
  );
}
