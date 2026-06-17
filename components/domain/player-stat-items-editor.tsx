"use client";

import { useState } from "react";

import { ItemPicker } from "@/components/domain/item-picker";
import type { GameItem } from "@/lib/items";

export function PlayerStatItemsEditor({
  namePrefix,
  defaultItemIds,
  items,
  itemVersion,
}: {
  namePrefix: string;
  defaultItemIds: Array<number | null>;
  items: GameItem[];
  itemVersion: string;
}) {
  const [itemIds, setItemIds] = useState<Array<number | null>>(() =>
    Array.from({ length: 7 }, (_, index) => defaultItemIds[index] ?? null),
  );

  return (
    <>
      {itemIds.map((itemId, index) => (
        <input key={index} type="hidden" name={`${namePrefix}.item${index}`} value={itemId ?? ""} />
      ))}
      <div className="flex shrink-0 items-center gap-1">
        {itemIds.map((itemId, index) => (
          <ItemPicker
            key={index}
            items={items}
            itemVersion={itemVersion}
            value={itemId}
            slotLabel={String(index)}
            onValueChange={(nextValue) =>
              setItemIds((previous) => previous.map((value, itemIndex) => (itemIndex === index ? nextValue : value)))
            }
          />
        ))}
      </div>
    </>
  );
}
