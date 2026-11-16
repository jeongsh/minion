"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import type { AppNotification } from "@/lib/notifications";

const MEMBER_POLL_MS = 60_000;
const GUEST_POLL_MS = 5 * 60_000;
const COMMUNITY_POLL_MS = 5_000;

export function isRemoteNotificationId(id: string) {
  return id.startsWith("community:") || id.startsWith("content:");
}

export function useCommunityNotifications(identityScope: string, onNewNotification?: (notification: AppNotification) => void) {
  const pathname = usePathname();
  const communityPage = pathname === "/community" || pathname.startsWith("/community/") || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
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
    const pollMs = communityPage ? COMMUNITY_POLL_MS : identityScope === "guest" ? GUEST_POLL_MS : MEMBER_POLL_MS;
    let polling = false;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || polling) return;
      polling = true;
      void refresh(controller.signal).catch(() => undefined).finally(() => { polling = false; });
    };
    const initialLoad = window.setTimeout(refreshWhenVisible, 0);
    const interval = window.setInterval(refreshWhenVisible, pollMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [identityScope, refresh, communityPage]);

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

  const mutateActivity = useCallback((method: "PATCH" | "DELETE") => {
    const readAt = new Date().toISOString();
    setState(current => current.identityScope === identityScope ? {
      ...current,
      notifications: current.notifications.flatMap(item => {
        if (item.activityKind !== "post_comment" && item.activityKind !== "comment_reply") return [item];
        return method === "DELETE" ? [] : [{ ...item, readAt: item.readAt ?? readAt }];
      }),
    } : current);
    void fetch(method === "DELETE" ? "/api/notifications?all=true&activityOnly=true" : "/api/notifications", {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method === "PATCH" ? { body: JSON.stringify({ all: true, activityOnly: true }) } : {}),
    }).then(response => { if (!response.ok) return refresh(); }).catch(() => refresh());
  }, [identityScope, refresh]);

  return { notifications, markRead, markAllRead, remove, clear, refresh, mutateActivity };
}
