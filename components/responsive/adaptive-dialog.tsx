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
        <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ui-muted)] outline-none hover:bg-[var(--ui-surface-muted)] focus-visible:text-[var(--ui-ink)] sm:h-8 sm:w-8 sm:rounded-lg sm:hover:bg-transparent sm:hover:text-[var(--ui-ink)]" aria-label={closeLabel}><X size={18} className="sm:size-4" /></button>
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

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-label={triggerAriaLabel} aria-current={triggerAriaCurrent} aria-haspopup="dialog" aria-expanded={open}>
        {trigger}
      </button>
      <ControlledDialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} panelClassName={panelClassName}>
        <DialogSheetHeader onClose={() => setOpen(false)} title={title} titleId={titleId} />
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" onClick={event=>{if((event.target as HTMLElement).closest("a")) setOpen(false);}}>{children}</div>
      </ControlledDialog>
    </>
  );
}

const dialogStack: HTMLElement[] = [];
let bodyOverflow = "";

export function ControlledDialog({open,onClose,labelledBy,children,panelClassName="sm:max-w-[680px]"}: {
  open:boolean;onClose:()=>void;labelledBy:string;children:React.ReactNode;panelClassName?:string;
}) {
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef(onClose);
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{
    if(!open) return;
    const panel=dialogRef.current;
    if(!panel) return;
    const previousFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if(!dialogStack.length){bodyOverflow=document.body.style.overflow;document.body.style.overflow="hidden";}
    dialogStack.push(panel);
    const focusables=()=>Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length);
    const frame=requestAnimationFrame(()=>{if(!panel.contains(document.activeElement)) (focusables()[0] ?? panel).focus();});
    const handleKey=(event:KeyboardEvent)=>{
      if(dialogStack.at(-1)!==panel || event.defaultPrevented) return;
      if(event.key==="Escape"){event.preventDefault();closeRef.current();return;}
      if(event.key!=="Tab") return;
      const items=focusables(),first=items[0],last=items.at(-1);
      if(!first){event.preventDefault();panel.focus();return;}
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    };
    window.addEventListener("keydown",handleKey);
    return ()=>{
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown",handleKey);
      const index=dialogStack.indexOf(panel);if(index>=0)dialogStack.splice(index,1);
      if(!dialogStack.length)document.body.style.overflow=bodyOverflow;
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    };
  },[open]);
  if(!open || typeof document==="undefined")return null;
  return createPortal(<div className="modal-backdrop fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)onClose();}}>
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`adaptive-dialog-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl outline-none sm:rounded-[24px] ${panelClassName}`}>{children}</section>
  </div>,document.body);
}
