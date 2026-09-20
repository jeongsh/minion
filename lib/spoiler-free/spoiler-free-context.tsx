"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "minion-spoiler-free-v1";
const CHANGE_EVENT = "minion-spoiler-free-change";
const REVEALED_STORAGE_KEY = "minion-revealed-matches-v1";

function getRevealedSnapshot() {
  try {
    return window.localStorage.getItem(REVEALED_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseRevealedIds(snapshot: string): Set<string> {
  try {
    const value: unknown = JSON.parse(snapshot);
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function getServerRevealedSnapshot() {
  return "[]";
}

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
  const revealedSnapshot = useSyncExternalStore(subscribe, getRevealedSnapshot, getServerRevealedSnapshot);
  const savedRevealedIds = useMemo(() => parseRevealedIds(revealedSnapshot), [revealedSnapshot]);

  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "0" : "1");
    } catch {
      // 저장 실패해도 이번 세션 동작은 유지
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [enabled]);

  const reveal = useCallback((matchId: string) => {
    // Read at interaction time so records from other tabs are preserved.
    const savedIds = parseRevealedIds(getRevealedSnapshot());
    if (!savedIds.has(matchId)) {
      savedIds.add(matchId);
      try {
        window.localStorage.setItem(REVEALED_STORAGE_KEY, JSON.stringify([...savedIds]));
      } catch {
        // Keep the in-memory record when browser storage is unavailable.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
    setRevealedIds((current) => {
      if (current.has(matchId)) return current;
      const next = new Set(current);
      next.add(matchId);
      return next;
    });
  }, []);

  const isRevealed = useCallback((matchId: string) => revealedIds.has(matchId) || savedRevealedIds.has(matchId), [revealedIds, savedRevealedIds]);

  const value = useMemo(() => ({ enabled, toggle, isRevealed, reveal }), [enabled, toggle, isRevealed, reveal]);

  return <SpoilerFreeContext.Provider value={value}>{children}</SpoilerFreeContext.Provider>;
}

export function useSpoilerFree() {
  const context = useContext(SpoilerFreeContext);
  if (!context) throw new Error("useSpoilerFree must be used within a SpoilerFreeProvider");
  return context;
}
