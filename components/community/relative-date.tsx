"use client";

import { useSyncExternalStore } from "react";
import { formatCommunityDate, formatRelativeOrDate } from "@/components/community/format";

const subscribe = () => () => {};

/** Hydrate with a deterministic date before computing time-dependent relative text. */
export function RelativeDate({ value }: { value: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelativeOrDate(value),
    () => formatCommunityDate(value),
  );
  return <time dateTime={value}>{label}</time>;
}
