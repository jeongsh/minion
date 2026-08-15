"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { LiveMatchEvent, LiveMatchResponse } from "@/app/api/matches/[matchId]/live/route";
import { useToast } from "@/components/ui/toast";
import type { LiveMatchActivity, MatchActivityResponse } from "@/lib/match-activity";
import type { AppNotification } from "@/lib/notifications";

const ACTIVITY_POLL_MS = 30_000;
const LIVE_EVENT_POLL_MS = 10_000;
const ALERT_STORAGE_KEY = "minion-match-activity-alerts";
const ALERT_CHANGE_EVENT = "minion-match-activity-alert-change";
const NOTIFICATION_STORAGE_KEY = "minion-notifications-v1";
const NOTIFICATION_CHANGE_EVENT = "minion-notifications-change";
const EMPTY_NOTIFICATIONS_JSON = "[]";

const EMPTY_ACTIVITY: MatchActivityResponse = { liveMatches: [], ratings: [] };

function subscribeToAlertSetting(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ALERT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ALERT_CHANGE_EVENT, onStoreChange);
  };
}

function getAlertSetting() {
  return window.localStorage.getItem(ALERT_STORAGE_KEY) === "on";
}

function subscribeToNotifications(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(NOTIFICATION_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(NOTIFICATION_CHANGE_EVENT, onStoreChange);
  };
}

function getNotificationsSnapshot() {
  return window.localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? EMPTY_NOTIFICATIONS_JSON;
}

function parseNotifications(value: string): AppNotification[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as AppNotification[] : [];
  } catch {
    return [];
  }
}

function updateStoredNotifications(update: (current: AppNotification[]) => AppNotification[]) {
  const current = parseNotifications(getNotificationsSnapshot());
  const next = update(current).slice(0, 100);
  window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
}

function liveEventPresentation(event: LiveMatchEvent, match: LiveMatchActivity) {
  const matchup = `${match.teamA.shortName} vs ${match.teamB.shortName}`;
  if (event.type === "kill") {
    return {
      badge: "LIVE" as const,
      kind: event.type,
      matchup,
      leftLabel: event.killerSummonerName ?? "선수",
      rightLabel: event.victimSummonerName ?? "상대 선수",
    };
  }

  const teamLabel = event.teamId === match.teamA.id
    ? match.teamA.shortName
    : event.teamId === match.teamB.id
      ? match.teamB.shortName
      : "경기";
  const objectiveLabel = event.type === "baron"
    ? "바론"
    : event.type === "dragon"
      ? "드래곤"
      : event.type === "tower"
        ? "포탑"
        : event.type === "inhibitor"
          ? "억제기"
          : "종료";

  return {
    badge: "LIVE" as const,
    kind: event.type,
    matchup,
    leftLabel: event.type === "end" ? "세트" : teamLabel,
    rightLabel: objectiveLabel,
  };
}

export function useMatchActivity(enabled: boolean, followedTeamIds: string[] = []) {
  const { showToast } = useToast();
  const [activity, setActivity] = useState<MatchActivityResponse>(EMPTY_ACTIVITY);
  const alertsEnabled = useSyncExternalStore(subscribeToAlertSetting, getAlertSetting, () => false);
  const notificationsJson = useSyncExternalStore(subscribeToNotifications, getNotificationsSnapshot, () => EMPTY_NOTIFICATIONS_JSON);
  const notifications = useMemo(() => parseNotifications(notificationsJson), [notificationsJson]);
  const initialized = useRef(false);
  const previousLiveIds = useRef(new Set<string>());
  const previousRatingIds = useRef(new Set<string>());
  const eventIdsByMatch = useRef(new Map<string, Set<string>>());
  const followedTeamIdSet = useMemo(() => new Set(followedTeamIds), [followedTeamIds]);
  const alertLiveMatches = useMemo(
    () => activity.liveMatches.filter((match) => followedTeamIdSet.has(match.teamA.id) || followedTeamIdSet.has(match.teamB.id)),
    [activity.liveMatches, followedTeamIdSet],
  );

  const publishNotification = useCallback((notification: AppNotification, duration: number) => {
    updateStoredNotifications((current) => current.some((item) => item.id === notification.id)
      ? current
      : [notification, ...current]);
    showToast({
      title: notification.title,
      description: notification.description,
      tone: "info",
      duration,
      actionHref: notification.href,
      matchEvent: notification.matchEvent,
    });
  }, [showToast]);

  const markNotificationRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    updateStoredNotifications((current) => current.map((item) => item.id === id && !item.readAt ? { ...item, readAt } : item));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const readAt = new Date().toISOString();
    updateStoredNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
  }, []);

  const removeNotification = useCallback((id: string) => {
    updateStoredNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    updateStoredNotifications(() => []);
  }, []);

  const loadActivity = useCallback(async () => {
    if (!enabled) {
      setActivity(EMPTY_ACTIVITY);
      return;
    }

    try {
      const response = await fetch("/api/me/match-activity", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as MatchActivityResponse;

      if (initialized.current && alertsEnabled) {
        const followedLiveMatches = next.liveMatches.filter(
          (match) => followedTeamIdSet.has(match.teamA.id) || followedTeamIdSet.has(match.teamB.id),
        );
        for (const match of followedLiveMatches) {
          if (!previousLiveIds.current.has(match.id)) {
            publishNotification({
              id: `match-live:${match.id}`,
              kind: "match_live",
              title: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
              description: "팔로우한 팀의 경기가 시작됐어요.",
              href: match.href,
              createdAt: new Date().toISOString(),
              readAt: null,
              matchEvent: {
                badge: "LIVE",
                kind: "start",
                matchup: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
                leftLabel: "경기",
                rightLabel: "시작",
              },
            }, 6000);
          }
        }
        for (const rating of next.ratings) {
          if (!previousRatingIds.current.has(rating.id)) {
            publishNotification({
              id: `rating-open:${rating.id}`,
              kind: "rating_open",
              title: `${rating.setNumber}세트 평가가 열렸어요`,
              description: `${rating.teamA.shortName} vs ${rating.teamB.shortName}`,
              href: rating.href,
              createdAt: new Date().toISOString(),
              readAt: null,
              matchEvent: {
                badge: "평가",
                kind: "rating",
                matchup: `${rating.teamA.shortName} vs ${rating.teamB.shortName}`,
                leftLabel: `${rating.setNumber}세트`,
                rightLabel: "평가하기",
              },
            }, 7000);
          }
        }
      }

      previousLiveIds.current = new Set(
        next.liveMatches
          .filter((match) => followedTeamIdSet.has(match.teamA.id) || followedTeamIdSet.has(match.teamB.id))
          .map((match) => match.id),
      );
      previousRatingIds.current = new Set(next.ratings.map((rating) => rating.id));
      initialized.current = true;
      setActivity(next);
    } catch {
      // 전역 보조 UI이므로 네트워크 오류가 페이지 탐색을 막지 않게 조용히 유지한다.
    }
  }, [alertsEnabled, enabled, followedTeamIdSet, publishNotification]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadActivity(), 0);
    const interval = window.setInterval(() => void loadActivity(), ACTIVITY_POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadActivity();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadActivity]);

  useEffect(() => {
    if (!enabled || !alertsEnabled || alertLiveMatches.length === 0) return;

    const pollEvents = async () => {
      await Promise.all(alertLiveMatches.map(async (match) => {
        try {
          const response = await fetch(`/api/matches/${encodeURIComponent(match.id)}/live`, { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json() as LiveMatchResponse;
          if (!("events" in data)) return;

          const known = eventIdsByMatch.current.get(match.id);
          const currentIds = new Set(data.events.map((event) => event.id));
          if (!known) {
            eventIdsByMatch.current.set(match.id, currentIds);
            return;
          }

          const newEvents = data.events.filter((event) => !known.has(event.id)).slice(-2);
          eventIdsByMatch.current.set(match.id, currentIds);
          for (const event of newEvents) {
            publishNotification({
              id: `match-event:${event.id}`,
              kind: "match_event",
              title: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
              href: match.href,
              createdAt: new Date().toISOString(),
              readAt: null,
              matchEvent: liveEventPresentation(event, match),
            }, 6000);
          }
        } catch {
          // 라이브 피드가 잠시 끊겨도 다음 폴링에서 이어 받는다.
        }
      }));
    };

    void pollEvents();
    const interval = window.setInterval(() => void pollEvents(), LIVE_EVENT_POLL_MS);
    return () => window.clearInterval(interval);
  }, [alertLiveMatches, alertsEnabled, enabled, publishNotification]);

  const unreadNotificationCount = notifications.filter((notification) => !notification.readAt).length;

  return {
    activity,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearNotifications,
    refresh: loadActivity,
  };
}
