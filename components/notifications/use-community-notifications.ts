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

export function useCommunityNotifications(identityScope: string, canReceiveNotifications: boolean, onNewNotification?: (notification: AppNotification) => void) {
  const pathname = usePathname();
  const communityPage = pathname === "/community" || pathname.startsWith("/community/") || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
  const [state, setState] = useState<{ identityScope: string; notifications: AppNotification[] }>({
    identityScope: "",
    notifications: [],
  });
  const knownNotificationIds = useRef<{ identityScope: string; ids: Set<string> } | null>(null);
  const onNewNotificationRef = useRef(onNewNotification);
  const mutations = useRef({ revision: 0, pending: 0 });
  const notifications = state.identityScope === identityScope ? state.notifications : [];

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (mutations.current.pending > 0 || signal?.aborted) return;
    const revision = mutations.current.revision;
    const response = await fetch("/api/notifications", { cache: "no-store", signal });
    if (!response.ok) return;
    const body = await response.json() as { notifications?: AppNotification[] };
    // A response started before a read/delete must not restore stale inbox state.
    if (signal?.aborted || mutations.current.revision !== revision) return;
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
    const pollMs = communityPage && canReceiveNotifications
      ? COMMUNITY_POLL_MS
      : identityScope === "guest" ? GUEST_POLL_MS : MEMBER_POLL_MS;
    let polling = false;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || polling) return;
      polling = true;
      void refresh(controller.signal).catch(() => undefined).finally(() => { polling = false; });
    };
    const initialLoad = canReceiveNotifications ? window.setTimeout(refreshWhenVisible, 0) : undefined;
    const interval = canReceiveNotifications ? window.setInterval(refreshWhenVisible, pollMs) : undefined;
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
  }, [identityScope, refresh, communityPage, canReceiveNotifications]);

  const mutate = useCallback(async (url: string, options: RequestInit) => {
    mutations.current.revision += 1;
    mutations.current.pending += 1;
    try {
      const response = await fetch(url, { ...options, keepalive: true });
      if (!response.ok) throw new Error("Notification update failed");
    } catch {
      // Reconcile failed optimistic updates once all outstanding writes settle.
    } finally {
      mutations.current.revision += 1;
      mutations.current.pending -= 1;
      if (mutations.current.pending === 0) void refresh().catch(() => undefined);
    }
  }, [refresh]);

  const markRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    setState((current) => current.identityScope === identityScope
      ? { ...current, notifications: current.notifications.map((item) => item.id === id && !item.readAt ? { ...item, readAt } : item) }
      : current);
    return mutate("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(5_000),
    });
  }, [identityScope, mutate]);

  const markAllRead = useCallback(() => {
    const readAt = new Date().toISOString();
    setState((current) => current.identityScope === identityScope
      ? { ...current, notifications: current.notifications.map((item) => item.readAt ? item : { ...item, readAt }) }
      : current);
    void mutate("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, [identityScope, mutate]);

  const remove = useCallback((id: string) => {
    setState((current) => current.identityScope === identityScope
      ? { ...current, notifications: current.notifications.filter((item) => item.id !== id) }
      : current);
    void mutate(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }, [identityScope, mutate]);

  const clear = useCallback(() => {
    setState((current) => current.identityScope === identityScope ? { ...current, notifications: [] } : current);
    void mutate("/api/notifications?all=true", { method: "DELETE" });
  }, [identityScope, mutate]);

  const mutateActivity = useCallback((method: "PATCH" | "DELETE") => {
    const readAt = new Date().toISOString();
    setState(current => current.identityScope === identityScope ? {
      ...current,
      notifications: current.notifications.flatMap(item => {
        if (item.activityKind !== "post_comment" && item.activityKind !== "comment_reply") return [item];
        return method === "DELETE" ? [] : [{ ...item, readAt: item.readAt ?? readAt }];
      }),
    } : current);
    void mutate(method === "DELETE" ? "/api/notifications?all=true&activityOnly=true" : "/api/notifications", {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method === "PATCH" ? { body: JSON.stringify({ all: true, activityOnly: true }) } : {}),
    });
  }, [identityScope, mutate]);

  return { notifications, markRead, markAllRead, remove, clear, refresh, mutateActivity };
}
