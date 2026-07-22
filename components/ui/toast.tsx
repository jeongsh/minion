"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  iconSrc?: string;
  duration?: number;
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
                const Icon = toneIcon[item.tone];
                return (
                  <div key={item.id} className={`app-toast app-toast--${item.tone} pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 shadow-xl shadow-black/10 dark:bg-[var(--ui-surface-muted)]`} role={item.tone === "error" ? "alert" : "status"}>
                    {item.iconSrc ? <img src={item.iconSrc} alt="" className="h-10 w-10 shrink-0 object-contain" /> : <Icon className="h-5 w-5 shrink-0 text-[var(--app-toast-accent)]" strokeWidth={2.2} />}
                    <div className="min-w-0 flex-1">
                      <p className="font-paperozi truncate text-[17px] text-[var(--ui-ink)]">{item.title}</p>
                      {item.description ? <p className="mt-0.5 text-[13px] font-semibold text-[var(--ui-muted)]">{item.description}</p> : null}
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
