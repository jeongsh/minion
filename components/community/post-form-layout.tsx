import type { ReactNode } from "react";

import { SurfacePanel } from "@/components/ui/surface-panel";
import type { BoardScope } from "@/lib/community/boards";

export function PostFormLayout({ scope, children }: { scope: BoardScope; children: ReactNode }) {
  return (
    <main
      className={scope === "team"
        ? "fan-page-container flex min-h-[calc(100svh-48px)] flex-col gap-5 py-0 md:min-h-0 md:py-9"
        : "layout-wide flex min-h-[calc(100svh-48px)] flex-col gap-5 py-0 md:min-h-0 md:py-8"
      }
    >
      <SurfacePanel variant="section" className="mobile-full-bleed !overflow-visible rounded-none border-0 bg-transparent p-4 pb-[calc(72px+env(safe-area-inset-bottom))] md:mx-0 md:!overflow-hidden md:rounded-[var(--ui-card-radius)] md:border md:border-[var(--ui-border)] md:bg-[var(--ui-surface)] md:p-8">
        {children}
      </SurfacePanel>
    </main>
  );
}
