"use client";

import { createContext, useContext } from "react";
import type { AppNotification } from "@/lib/notifications";

// Next Link updates same-page hashes through history.pushState, without hashchange.
export function focusNotificationComment(href?: string) {
  if (!href) return false;
  const url = new URL(href, window.location.href);
  if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && url.hash.startsWith("#comment-")) {
    // Handle same-page targets without a competing Next Link navigation, which
    // can cancel the refresh needed to load a comment that has just arrived.
    window.dispatchEvent(new CustomEvent("community:comment-target", { detail: url.hash.slice(9) }));
    return true;
  }
  return false;
}

export const NotificationContext = createContext<{
  notifications: AppNotification[];
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  onReadAll: () => void;
  onClear: () => void;
} | null>(null);

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NotificationContext is required");
  return value;
}
