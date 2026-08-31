"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import type { MiniconPack } from "@/lib/minicons/types";
import { saveMiniconSettingsAction } from "./actions";

export function MiniconSettingsForm({
  packs,
  initialSelectedPackIds,
  initialSelectionSaved,
}: {
  packs: MiniconPack[];
  initialSelectedPackIds: string[];
  initialSelectionSaved: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedPackIds, setSelectedPackIds] = useState(initialSelectedPackIds);
  const [savedPackIds, setSavedPackIds] = useState(initialSelectionSaved ? initialSelectedPackIds : []);
  const [pending, startTransition] = useTransition();
  const selectedIds = useMemo(() => new Set(selectedPackIds), [selectedPackIds]);
  const hasChanges = selectedPackIds.join(",") !== savedPackIds.join(",");

  const togglePack = (pack: MiniconPack) => {
    if (selectedIds.has(pack.id)) {
      if (selectedPackIds.length === 1) {
        showToast({
          title: "한 개는 남겨 주세요",
          description: "미니콘 선택기에는 최소 한 개의 패키지가 필요합니다.",
          tone: "error",
        });
        return;
      }
      setSelectedPackIds((current) => current.filter((packId) => packId !== pack.id));
      return;
    }

    setSelectedPackIds((current) => [...current, pack.id]);
  };

  const save = () => {
    if (selectedPackIds.length === 0) {
      showToast({ title: "선택이 필요해요", description: "사용할 미니콘 패키지를 한 개 이상 선택해 주세요.", tone: "error" });
      return;
    }

    startTransition(async () => {
      const result = await saveMiniconSettingsAction({ packIds: selectedPackIds });
      showToast({
        title: result.ok ? "미니콘 설정 저장" : "저장 실패",
        description: result.ok ? result.message : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) {
        setSavedPackIds(selectedPackIds);
        router.refresh();
      }
    });
  };

  if (packs.length === 0) {
    return (
      <section className="rounded-lg bg-[var(--ui-surface-muted)] px-5 py-10 text-center">
        <p className="text-[16px] font-normal text-[var(--ui-muted)]">사용할 수 있는 미니콘이 없습니다.</p>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 py-1">
        <p className="text-[13px] font-medium text-[var(--ui-muted)]" aria-live="polite">
          선택 {selectedPackIds.length} / 전체 {packs.length}
        </p>
        <button
          type="button"
          disabled={pending || !hasChanges || selectedPackIds.length === 0}
          onClick={save}
          className="min-h-10 shrink-0 rounded-lg bg-[var(--ui-ink)] px-4 text-[14px] font-medium text-[var(--ui-surface)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "저장 중" : hasChanges ? "설정 저장" : "저장됨"}
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,152px))] justify-start gap-x-2.5 gap-y-3">
        {packs.map((pack) => {
          const selected = selectedIds.has(pack.id);

          return (
            <button
              key={pack.id}
              type="button"
              aria-pressed={selected}
              onClick={() => togglePack(pack)}
              className={`min-w-0 rounded-lg p-1.5 text-left transition ${selected ? "bg-[var(--ui-surface-muted)]" : "hover:bg-[var(--ui-surface-muted)]"}`}
            >
              <div className="relative aspect-square overflow-hidden rounded-md bg-[var(--ui-surface-muted)]">
                {/* 공개 스토리지 URL은 운영 중 추가될 수 있어 일반 이미지 요소로 표시한다. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pack.coverUrl}
                  alt={`${pack.name} 대표 미니콘`}
                  className="h-full w-full object-cover"
                />
                <span className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full ${selected ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-black/30 text-transparent"}`} aria-hidden="true">
                  <Check size={16} strokeWidth={2.5} />
                </span>
              </div>
              <div className="px-0.5 pt-1.5">
                <h2 className="truncate text-[15px] font-bold text-[var(--ui-ink)]">{pack.name}</h2>
                <p className="mt-0.5 text-[13px] font-normal text-[var(--ui-muted)]">미니콘 {pack.items.length}개</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
