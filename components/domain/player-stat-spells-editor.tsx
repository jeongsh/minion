"use client";

import { useState } from "react";

import { SpellPicker } from "@/components/domain/spell-picker";
import type { GameSpell } from "@/lib/spells";

export function PlayerStatSpellsEditor({
  namePrefix,
  defaultSpellIds,
  spells,
  itemVersion,
}: {
  namePrefix: string;
  defaultSpellIds: Array<number | null>;
  spells: GameSpell[];
  itemVersion: string;
}) {
  const [spellIds, setSpellIds] = useState<Array<number | null>>(() =>
    Array.from({ length: 2 }, (_, index) => defaultSpellIds[index] ?? null),
  );

  return (
    <>
      {spellIds.map((spellId, index) => (
        <input key={index} type="hidden" name={`${namePrefix}.spell${index}`} value={spellId ?? ""} />
      ))}
      <div className="flex shrink-0 items-center gap-1">
        {spellIds.map((spellId, index) => (
          <SpellPicker
            key={index}
            spells={spells}
            itemVersion={itemVersion}
            value={spellId}
            slotLabel={String(index + 1)}
            onValueChange={(nextValue) =>
              setSpellIds((previous) => previous.map((value, spellIndex) => (spellIndex === index ? nextValue : value)))
            }
          />
        ))}
      </div>
    </>
  );
}
