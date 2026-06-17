"use client";

import { useState } from "react";

import { RunePicker } from "@/components/domain/rune-picker";
import type { RuneCatalog } from "@/lib/runes";

export function PlayerStatRunesEditor({
  namePrefix,
  defaultRuneIds,
  runeCatalog,
}: {
  namePrefix: string;
  defaultRuneIds: Array<number | null>;
  runeCatalog: RuneCatalog;
}) {
  const [keystoneId, setKeystoneId] = useState<number | null>(() => defaultRuneIds[0] ?? null);
  const [treeId, setTreeId] = useState<number | null>(() => defaultRuneIds[1] ?? null);

  return (
    <>
      <input type="hidden" name={`${namePrefix}.rune0`} value={keystoneId ?? ""} />
      <input type="hidden" name={`${namePrefix}.rune1`} value={treeId ?? ""} />
      <div className="flex shrink-0 items-end gap-1">
        <RunePicker
          runes={runeCatalog.keystones}
          value={keystoneId}
          size="lg"
          slotLabel="K"
          searchPlaceholder="키스톤 검색 (감전, 여진…)"
          dialogLabel="키스톤 선택"
          onValueChange={setKeystoneId}
        />
        <RunePicker
          runes={runeCatalog.trees}
          value={treeId}
          size="sm"
          slotLabel="T"
          searchPlaceholder="보조 계열 검색 (지배, 결의…)"
          dialogLabel="보조 계열 선택"
          onValueChange={setTreeId}
        />
      </div>
    </>
  );
}
