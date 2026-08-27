"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppNotification } from "@/lib/notifications";

const POLL_MS = 15_000;

export function isCommunityNotificationId(id: string) {
  return id.startsWith("community:");
}

export function useCommunityNotifications(identityScope: string) {
  const [state, setState] = useState<{ identityScope: string; notifications: AppNotification[] }>({
    identityScope: "",
    notifications: [],
  });
  const notifications = state.identityScope === identityScope ? state.notifications : [];

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/notifications", { cache: "no-store", signal });
    if (!response.ok) return;
    const body = await response.json() as { notifications?: AppNotification[] };
    setState({ identityScope, notifications: Array.isArray(body.notifications) ? body.notifications : [] });
  }, [identityScope]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void refresh(controller.signal).catch(() => undefined), 0);
    const interval = window.setInterval(() => void refresh().catch(() => undefined), POLL_MS);
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
