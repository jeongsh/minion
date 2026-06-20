import Image from "next/image";

import type { ObjectiveIconSlot } from "@/lib/objectives";

function ObjectiveIcon({ src, label, size = 20 }: { src: string; label: string; size?: number }) {
  return (
    <Image
      src={src}
      alt={label}
      width={size}
      height={size}
      unoptimized
      title={label}
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}

export function ObjectiveIconSlots({
  icons,
  align = "left",
  emptyText = "-",
  size,
}: {
  icons: ObjectiveIconSlot[];
  align?: "left" | "right";
  emptyText?: string;
  size?: number;
}) {
  if (icons.length === 0) {
    return <span className="text-xs font-semibold text-muted">{emptyText}</span>;
  }

  return (
    <span
      className={`inline-flex max-w-full flex-wrap gap-0.5 ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {icons.map((icon) => (
        <ObjectiveIcon key={icon.key} src={icon.src} label={icon.label} size={size} />
      ))}
    </span>
  );
}
