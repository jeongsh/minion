"use client";

import { useState } from "react";
import Image from "next/image";

import { itemImageUrl } from "@/lib/items";

function hasItem(itemId: number | null | undefined): itemId is number {
  return itemId != null && itemId > 0;
}

function isRegularItem(itemId: number): boolean {
  return itemId < 1200 || itemId >= 2000;
}

function compactItemSlots(itemIds: Array<number | null | undefined>) {
  const items = itemIds.slice(0, 6).filter(hasItem).filter(isRegularItem);
  return [...items, ...Array<number | null>(6).fill(null)].slice(0, 6);
}

function ItemSlot({
  itemId,
  version,
  slotClassName,
  imageSizes,
}: {
  itemId: number | null | undefined;
  version: string;
  slotClassName: string;
  imageSizes: string;
}) {
  return (
    <span className={`relative shrink-0 overflow-hidden rounded border border-border/50 bg-surface-muted ${slotClassName}`}>
      {hasItem(itemId) ? (
        <Image src={itemImageUrl(itemId, version)} alt="" fill sizes={imageSizes} className="object-cover" />
      ) : null}
    </span>
  );
}

function RoleBoundItemSlot({
  roleBoundItem,
  version,
  slotClassName,
  imageSizes,
}: {
  roleBoundItem: number;
  version: string;
  slotClassName: string;
  imageSizes: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`relative shrink-0 overflow-hidden rounded border border-border/50 bg-surface-muted ${slotClassName}`}>
      {!failed ? (
        <Image
          src={itemImageUrl(roleBoundItem, version)}
          alt=""
          fill
          sizes={imageSizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

export function PlayerItemSlots({
  itemIds,
  roleBoundItem,
  version,
  className = "",
  slotClassName = "h-7 w-7",
  separatorClassName = "h-4 w-px",
  imageSizes = "28px",
}: {
  itemIds: Array<number | null | undefined>;
  roleBoundItem: number | null | undefined;
  version: string;
  className?: string;
  slotClassName?: string;
  separatorClassName?: string;
  imageSizes?: string;
}) {
  const items = compactItemSlots(itemIds);
  const trinket = itemIds[6] ?? null;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {items.map((itemId, index) => (
        <ItemSlot
          key={`item-${index}`}
          itemId={itemId}
          version={version}
          slotClassName={slotClassName}
          imageSizes={imageSizes}
        />
      ))}
      <span className={`mx-0.5 shrink-0 bg-border/50 ${separatorClassName}`} aria-hidden="true" />
      <ItemSlot itemId={trinket} version={version} slotClassName={slotClassName} imageSizes={imageSizes} />
      <span className={`mx-0.5 shrink-0 bg-border/50 ${separatorClassName}`} aria-hidden="true" />
      {hasItem(roleBoundItem) ? (
        <RoleBoundItemSlot
          roleBoundItem={roleBoundItem}
          version={version}
          slotClassName={slotClassName}
          imageSizes={imageSizes}
        />
      ) : (
        <ItemSlot itemId={null} version={version} slotClassName={slotClassName} imageSizes={imageSizes} />
      )}
    </div>
  );
}
