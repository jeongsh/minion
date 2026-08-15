"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Info, Radio, Star, Sword, X } from "lucide-react";

import type { MatchEventPresentation } from "@/lib/notifications";
import { OBJECTIVE_ICONS } from "@/lib/objectives";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  iconSrc?: string;
  duration?: number;
  actionHref?: string;
  actionLabel?: string;
  matchEvent?: MatchEventPresentation;
};

type ToastItem = ToastInput & {
  id: number;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function MatchEventIcon({ kind }: { kind: MatchEventPresentation["kind"] }) {
  if (kind === "kill") return <Sword size={15} strokeWidth={2} />;
  if (kind === "start") return <Radio size={15} strokeWidth={2} />;
  if (kind === "rating") return <Star size={15} strokeWidth={2} />;
  if (kind === "end") return <span className="text-[12px] font-medium">END</span>;

  const src = kind === "baron"
    ? OBJECTIVE_ICONS.baron
    : kind === "dragon"
      ? OBJECTIVE_ICONS.dragon
      : OBJECTIVE_ICONS.tower;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-4 w-4 object-contain dark:invert" />
  );
}

function MatchEventToast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const event = item.matchEvent!;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium">
        {event.badge === "LIVE" ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full !bg-[#ff3158]" aria-hidden /> : <Star size={13} />}
        <span className={event.badge === "LIVE" ? "text-[#e51643]" : "text-[var(--accent)]"}>{event.badge}</span>
        <span className="truncate text-[var(--ui-muted)]">{event.matchup}</span>
      </span>
      <span className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] items-center gap-1 text-[13px] font-bold text-[var(--ui-ink)]">
        <span className="truncate text-right">{event.leftLabel ?? ""}</span>
        <span className="mx-auto grid h-6 w-6 place-items-center rounded-md bg-[var(--ui-card-bg)] text-[var(--ui-muted)]"><MatchEventIcon kind={event.kind} /></span>
        <span className="truncate">{event.rightLabel}</span>
      </span>
    </>
  );

  return (
    <div className="app-toast pointer-events-auto flex w-full max-w-[22rem] items-center overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] py-2 pl-3 pr-1.5 shadow-lg shadow-black/10 dark:bg-[var(--ui-surface-muted)]" role="status">
      {item.actionHref ? <Link href={item.actionHref} onClick={onClose} className="min-w-0 flex-1">{content}</Link> : <span className="min-w-0 flex-1">{content}</span>}
      <button type="button" onClick={onClose} className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]" aria-label="알림 닫기"><X size={15} /></button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const mounted = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const removeToast = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const next: ToastItem = { ...toast, id, tone: toast.tone ?? "info" };
    setItems((current) => [...current.slice(-2), next]);
    window.setTimeout(() => removeToast(id), toast.duration ?? 2400);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-4 top-20 z-[1200] flex flex-col items-center gap-2 sm:top-24" aria-live="polite" aria-atomic="true">
              {items.map((item) => {
                if (item.matchEvent) {
                  return <MatchEventToast key={item.id} item={item} onClose={() => removeToast(item.id)} />;
                }
                const Icon = toneIcon[item.tone];
                return (
                  <div key={item.id} className={`app-toast app-toast--${item.tone} pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 shadow-xl shadow-black/10 dark:bg-[var(--ui-surface-muted)]`} role={item.tone === "error" ? "alert" : "status"}>
                    {item.iconSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.iconSrc} alt="" className="h-10 w-10 shrink-0 object-contain" />
                    ) : <Icon className="h-5 w-5 shrink-0 text-[var(--app-toast-accent)]" strokeWidth={2.2} />}
                    <div className="min-w-0 flex-1">
                      <p className="font-paperozi truncate text-[17px] text-[var(--ui-ink)]">{item.title}</p>
                      {item.description ? <p className="mt-0.5 text-[13px] font-semibold text-[var(--ui-muted)]">{item.description}</p> : null}
                      {item.actionHref && item.actionLabel ? (
                        <Link href={item.actionHref} onClick={() => removeToast(item.id)} className="mt-1.5 inline-flex min-h-8 items-center text-[13px] font-bold text-[var(--accent)]">
                          {item.actionLabel}
                        </Link>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => removeToast(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]" aria-label="알림 닫기">
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
