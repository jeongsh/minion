"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AppNotification } from "@/lib/notifications";

const MEMBER_POLL_MS = 60_000;
const GUEST_POLL_MS = 5 * 60_000;

export function isRemoteNotificationId(id: string) {
  return id.startsWith("community:") || id.startsWith("content:");
}

export function useCommunityNotifications(identityScope: string, onNewNotification?: (notification: AppNotification) => void) {
  const [state, setState] = useState<{ identityScope: string; notifications: AppNotification[] }>({
    identityScope: "",
    notifications: [],
  });
  const knownNotificationIds = useRef<{ identityScope: string; ids: Set<string> } | null>(null);
  const onNewNotificationRef = useRef(onNewNotification);
  const notifications = state.identityScope === identityScope ? state.notifications : [];

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/notifications", { cache: "no-store", signal });
    if (!response.ok) return;
    const body = await response.json() as { notifications?: AppNotification[] };
    const next = Array.isArray(body.notifications) ? body.notifications : [];
    const previous = knownNotificationIds.current;
    knownNotificationIds.current = { identityScope, ids: new Set(next.map((notification) => notification.id)) };
    if (previous?.identityScope === identityScope) {
      for (const notification of next) {
        if (!previous.ids.has(notification.id) && (notification.kind === "team_video" || notification.kind === "team_social")) {
          onNewNotificationRef.current?.(notification);
        }
      }
    }
    setState({ identityScope, notifications: next });
  }, [identityScope]);

  useEffect(() => {
    knownNotificationIds.current = null;
    const controller = new AbortController();
    const pollMs = identityScope === "guest" ? GUEST_POLL_MS : MEMBER_POLL_MS;
    const initialLoad = window.setTimeout(() => void refresh(controller.signal).catch(() => undefined), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    }, pollMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [identityScope, refresh]);

  const markRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    setState((current) => current.identityScope === identityScope
      ? { ...current, notifications: current.notifications.map((item) => item.id === id && !item.readAt ? { ...item, readAt } : item) }
      : current);
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((response) => { if (!response.ok) return refresh(); }).catch(() => refresh());
  }, [identityScope, refresh]);

  const markAllRead = useCallback(() => {
    const readAt = new Date().toISOString();
    setState((current) => current.identityScope === identityScope
      ? { ...current, notifications: current.notifications.map((item) => item.readAt ? item : { ...item, readAt }) }
      : current);
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).then((response) => { if (!response.ok) return refresh(); }).catch(() => refresh());
  }, [identityScope, refresh]);

  const remove = useCallback((id: string) => {
    setState((current) => current.identityScope === identityScope
      ? { ...current, notifications: current.notifications.filter((item) => item.id !== id) }
      : current);
    void fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then((response) => { if (!response.ok) return refresh(); })
      .catch(() => refresh());
  }, [identityScope, refresh]);

  const clear = useCallback(() => {
    setState((current) => current.identityScope === identityScope ? { ...current, notifications: [] } : current);
    void fetch("/api/notifications?all=true", { method: "DELETE" })
      .then((response) => { if (!response.ok) return refresh(); })
      .catch(() => refresh());
  }, [identityScope, refresh]);

  return { notifications, markRead, markAllRead, remove, clear, refresh };
}
