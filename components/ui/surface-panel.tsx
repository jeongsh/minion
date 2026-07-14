import type { HTMLAttributes } from "react";

type SurfacePanelVariant = "card" | "section" | "list" | "media";

const mobileVariantClass: Record<SurfacePanelVariant, string> = {
  card: "",
  section: "mobile-surface-section",
  list: "mobile-surface-list",
  media: "mobile-surface-media",
};

type SurfacePanelProps = HTMLAttributes<HTMLElement> & {
  variant?: SurfacePanelVariant;
};

export function SurfacePanel({ className = "", variant = "card", ...props }: SurfacePanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] ${mobileVariantClass[variant]} ${className}`}
      {...props}
    />
  );
}
