"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "minion-spoiler-free-v1";
const CHANGE_EVENT = "minion-spoiler-free-change";

type SpoilerFreeContextValue = {
  enabled: boolean;
  toggle: () => void;
  isRevealed: (matchId: string) => boolean;
  reveal: (matchId: string) => void;
};

const SpoilerFreeContext = createContext<SpoilerFreeContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

// 저장된 값이 없으면(첫 방문) 기본값은 켜짐 — 명시적으로 "0"을 저장한 경우에만 꺼진다.
function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function getServerSnapshot() {
  return true;
}

export function SpoilerFreeProvider({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "0" : "1");
    } catch {
      // 저장 실패해도 이번 세션 동작은 유지
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [enabled]);

  const reveal = useCallback((matchId: string) => {
    setRevealedIds((current) => {
      if (current.has(matchId)) return current;
      const next = new Set(current);
      next.add(matchId);
      return next;
    });
  }, []);

  const isRevealed = useCallback((matchId: string) => revealedIds.has(matchId), [revealedIds]);

  const value = useMemo(() => ({ enabled, toggle, isRevealed, reveal }), [enabled, toggle, isRevealed, reveal]);

  return <SpoilerFreeContext.Provider value={value}>{children}</SpoilerFreeContext.Provider>;
}

export function useSpoilerFree() {
  const context = useContext(SpoilerFreeContext);
  if (!context) throw new Error("useSpoilerFree must be used within a SpoilerFreeProvider");
  return context;
}
