"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function DialogSheetHandle({ className = "sm:hidden" }: { className?: string }) {
  return <div aria-hidden="true" className={`mx-auto mb-2 mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--ui-border)] ${className}`} />;
}

export function DialogSheetHeader({
  actions,
  closeLabel = "닫기",
  handleClassName,
  headerClassName = "",
  onClose,
  title,
  titleClassName = "",
  titleId,
}: {
  actions?: React.ReactNode;
  closeLabel?: string;
  handleClassName?: string;
  headerClassName?: string;
  onClose: () => void;
  title: React.ReactNode;
  titleClassName?: string;
  titleId?: string;
}) {
  return (
    <>
      <DialogSheetHandle className={handleClassName} />
      <header className={`flex min-h-12 shrink-0 items-center gap-1 px-4 sm:px-5 ${headerClassName}`}>
        <h2 id={titleId} className={`font-paperozi min-w-0 flex-1 truncate text-[16px] tracking-[-0.02em] text-[var(--ui-ink)] ${titleClassName}`}>{title}</h2>
        {actions}
        <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" aria-label={closeLabel}><X size={21} /></button>
      </header>
    </>
  );
}

export function AdaptiveDialog({
  title,
  trigger,
  children,
  triggerClassName = "",
  triggerAriaLabel,
  triggerAriaCurrent,
  panelClassName = "sm:max-w-[680px]",
}: {
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  triggerAriaCurrent?: "page";
  /** 데스크탑 패널 폭 등 패널 자체 스타일. 기본은 본문형 680px. */
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button, a, input, select, textarea")?.focus(), 0);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
      (activeElement ?? triggerElement)?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-label={triggerAriaLabel} aria-current={triggerAriaCurrent} aria-haspopup="dialog" aria-expanded={open}>
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          className="modal-backdrop fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`adaptive-dialog-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl sm:rounded-[24px] ${panelClassName}`}
          >
            <DialogSheetHeader onClose={() => setOpen(false)} title={title} titleId={titleId} />
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</div>
          </section>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
