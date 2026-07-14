"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export function AdaptiveDialog({
  title,
  trigger,
  children,
  triggerClassName = "",
}: {
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-haspopup="dialog" aria-expanded={open}>
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl sm:max-w-[680px] sm:rounded-[24px]"
          >
            <header className="flex min-h-14 items-center justify-between border-b border-[var(--ui-border)] px-4 sm:min-h-16 sm:px-5">
              <h2 id={titleId} className="text-[17px] font-black tracking-[-0.02em] text-[var(--ui-ink)] sm:text-lg">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" aria-label="닫기"><X size={21} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</div>
          </section>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
