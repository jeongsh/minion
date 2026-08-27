import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'minion-spoiler-free-v1';

type SpoilerFreeContextValue = {
  enabled: boolean;
  toggle: () => void;
  isRevealed: (matchId: string) => boolean;
  reveal: (matchId: string) => void;
};

const SpoilerFreeContext = createContext<SpoilerFreeContextValue | null>(null);

export function SpoilerFreeProvider({ children }: PropsWithChildren) {
  // 저장된 값이 없으면(첫 방문) 기본값은 켜짐 — 명시적으로 '0'을 저장한 경우에만 꺼진다.
  const [enabled, setEnabled] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === '0') setEnabled(false);
    });
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      void AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

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
  if (!context) throw new Error('useSpoilerFree must be used within a SpoilerFreeProvider');
  return context;
}
