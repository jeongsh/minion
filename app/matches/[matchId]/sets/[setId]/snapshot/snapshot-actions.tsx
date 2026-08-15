"use client";

import { Download, LoaderCircle, Share2 } from "lucide-react";
import { useState } from "react";

const SNAPSHOT_ID = "rating-share-card";
const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_HEIGHT = 1350;

async function makeSnapshot(filename: string) {
  const node = document.getElementById(SNAPSHOT_ID);
  if (!node) throw new Error("공유 이미지를 찾을 수 없습니다.");

  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    backgroundColor: "#07111f",
    cacheBust: true,
    canvasWidth: SHARE_IMAGE_WIDTH,
    canvasHeight: SHARE_IMAGE_HEIGHT,
    pixelRatio: 1,
  });

  if (!blob) throw new Error("이미지를 만들지 못했습니다.");
  return new File([blob], filename, { type: "image/png" });
}

function downloadFile(file: File, filename: string) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function SnapshotActions({ filename }: { filename: string }) {
  const [working, setWorking] = useState<"save" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setWorking("save");
    setError(null);
    try {
      const file = await makeSnapshot(filename);
      downloadFile(file, filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "이미지 저장에 실패했습니다.");
    } finally {
      setWorking(null);
    }
  };

  const share = async () => {
    setWorking("share");
    setError(null);
    try {
      const file = await makeSnapshot(filename);
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "미니언 팬 평점",
          text: "오늘 경기 팬 평점을 공유해 보세요.",
        });
      } else {
        downloadFile(file, filename);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "이미지 공유에 실패했습니다.");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={save} disabled={working !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--ui-ink)] px-4 text-sm font-bold text-[var(--ui-surface)] disabled:opacity-55">
          {working === "save" ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />}
          이미지 저장
        </button>
        <button type="button" onClick={share} disabled={working !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 text-sm font-bold text-[var(--ui-ink)] disabled:opacity-55">
          {working === "share" ? <LoaderCircle className="animate-spin" size={17} /> : <Share2 size={17} />}
          바로 공유
        </button>
      </div>
      {error ? <p className="text-center text-[13px] font-semibold text-red-500">{error}</p> : null}
      <p className="text-center text-[13px] text-[var(--ui-muted)]">SNS 피드에 최적화된 1080 × 1350px PNG로 저장됩니다.</p>
    </div>
  );
}
