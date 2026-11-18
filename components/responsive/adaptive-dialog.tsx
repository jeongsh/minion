"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export function DialogSheetHandle({ className = "sm:hidden" }: { className?: string }) {
  return <div aria-hidden="true" className={`mx-auto mb-2 mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--ui-border)] ${className}`} />;
}

/** 선수 평가 입력창과 같은 본문 간격. 하단 안전 영역은 여기서 한 번만 더한다. */
export const dialogBodyClassName = "dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain";

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
      <header className={`flex shrink-0 items-center gap-1 px-4 sm:px-5 ${headerClassName}`}>
        <h2 id={titleId} className={`font-paperozi min-w-0 flex-1 truncate text-[14px] sm:text-[16px] tracking-[-0.02em] text-[var(--ui-ink)] ${titleClassName}`}>{title}</h2>
        {actions}
        <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--ui-muted)] outline-none hover:bg-[var(--ui-surface-muted)] focus-visible:text-[var(--ui-ink)] sm:hover:bg-transparent sm:hover:text-[var(--ui-ink)]" aria-label={closeLabel}><X size={18} className="sm:size-4" /></button>
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
        <div className={dialogBodyClassName} onClick={event=>{if((event.target as HTMLElement).closest("a")) setOpen(false);}}>{children}</div>
      </ControlledDialog>
    </>
  );
}

const dialogStack: HTMLElement[] = [];
let bodyOverflow = "";

export function ControlledDialog({open,onClose,labelledBy,ariaLabel,children,panelClassName="sm:max-w-[680px]",panelStyle,backdropClassName="",portal=true,dismissible=true,desktopPopover=false}: {
  open:boolean;onClose:()=>void;labelledBy?:string;ariaLabel?:string;children:React.ReactNode;panelClassName?:string;
  panelStyle?:CSSProperties;backdropClassName?:string;portal?:boolean;dismissible?:boolean;desktopPopover?:boolean;
}) {
  const dialogRef=useRef<HTMLElement>(null);
  const rootRef=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);
  const dismissibleRef=useRef(dismissible);
  const [popoverDesktop,setPopoverDesktop]=useState(false);
  useEffect(()=>{closeRef.current=onClose;dismissibleRef.current=dismissible;},[onClose,dismissible]);
  useEffect(()=>{
    if(!desktopPopover)return;
    const media=window.matchMedia("(min-width: 1200px)");
    const update=()=>setPopoverDesktop(media.matches);
    update();media.addEventListener("change",update);
    return ()=>media.removeEventListener("change",update);
  },[desktopPopover]);
  useEffect(()=>{if(open && portal)rootRef.current?.showPopover?.();},[open,portal]);
  useEffect(()=>{
    if(!open || popoverDesktop) return;
    const panel=dialogRef.current;
    if(!panel) return;
    const previousFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if(!dialogStack.length){bodyOverflow=document.body.style.overflow;document.body.style.overflow="hidden";}
    dialogStack.push(panel);
    const focusables=()=>Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length);
    const frame=requestAnimationFrame(()=>{if(!panel.contains(document.activeElement)) (focusables()[0] ?? panel).focus();});
    const handleKey=(event:KeyboardEvent)=>{
      if(dialogStack.at(-1)!==panel || event.defaultPrevented) return;
      if(event.key==="Escape"){event.preventDefault();if(dismissibleRef.current)closeRef.current();return;}
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
  },[open,popoverDesktop]);
  if(!open || typeof document==="undefined")return null;
  const content=<div ref={rootRef} popover={portal ? "manual" : undefined} className={`dialog-root modal-backdrop fixed inset-0 z-[1000] m-0 flex h-auto w-auto items-end justify-center border-0 bg-black/45 p-0 text-inherit [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6 ${desktopPopover ? "dialog-desktop-popover" : ""} ${backdropClassName}`} role="presentation" onPointerDown={event=>{if(dismissible && event.currentTarget===event.target)onClose();}}>
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal={!popoverDesktop} aria-labelledby={labelledBy} aria-label={ariaLabel} style={panelStyle} className={`adaptive-dialog-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl outline-none sm:rounded-[24px] ${panelClassName}`}>{children}</section>
  </div>;
  return portal ? createPortal(content,document.body) : content;
}
