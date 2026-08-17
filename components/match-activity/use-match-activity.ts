"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { LiveMatchEvent, LiveMatchResponse } from "@/app/api/matches/[matchId]/live/route";
import { useToast } from "@/components/ui/toast";
import { championCatalogEntries, normalizeChampionKey } from "@/lib/champions";
import type { LiveMatchActivity, MatchActivityResponse, RatingMatchActivity } from "@/lib/match-activity";
import { DEFAULT_NOTIFICATION_PREFERENCES, type AppNotification, type NotificationPreferences } from "@/lib/notifications";
import { OBJECTIVE_ICONS } from "@/lib/objectives";

const ACTIVITY_POLL_MS = 30_000;
const LIVE_EVENT_POLL_MS = 10_000;
const LIVE_NOTIFICATION_DURATION_MS = 10_000;
const NOTIFICATION_STORAGE_KEY = "minion-notifications-v1";
const NOTIFICATION_CHANGE_EVENT = "minion-notifications-change";
const DISMISSED_RATING_CARD_STORAGE_KEY = "minion-dismissed-rating-cards-v1";
const DISMISSED_LIVE_CARD_STORAGE_KEY = "minion-dismissed-live-cards-v1";
const EMPTY_NOTIFICATIONS_JSON = "[]";

const EMPTY_ACTIVITY: MatchActivityResponse = { liveMatches: [], ratings: [] };

const CHAMPION_IMAGE_BY_KEY = new Map(
  championCatalogEntries().map((champion) => [
    normalizeChampionKey(champion.ddragon_id),
    `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champion.ddragon_id}_0.jpg`,
  ]),
);

const DRAGON_PRESENTATION: Record<string, { label: string; icon: string }> = {
  cloud: { label: "바람 드래곤", icon: OBJECTIVE_ICONS.cloud },
  infernal: { label: "화염 드래곤", icon: OBJECTIVE_ICONS.infernal },
  mountain: { label: "대지 드래곤", icon: OBJECTIVE_ICONS.mountain },
  ocean: { label: "바다 드래곤", icon: OBJECTIVE_ICONS.ocean },
  hextech: { label: "마법공학 드래곤", icon: OBJECTIVE_ICONS.hextech },
  chemtech: { label: "화학공학 드래곤", icon: OBJECTIVE_ICONS.chemtech },
  elder: { label: "장로 드래곤", icon: OBJECTIVE_ICONS.elder },
};

function championImage(championId: string | null) {
  return championId ? CHAMPION_IMAGE_BY_KEY.get(normalizeChampionKey(championId)) : undefined;
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

function dismissedRatingCardIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_RATING_CARD_STORAGE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function dismissedLiveCardIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_LIVE_CARD_STORAGE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function latestRating(ratings: RatingMatchActivity[]) {
  return ratings.reduce<RatingMatchActivity | null>((latest, rating) => {
    if (!latest) return rating;
    return new Date(rating.closesAt).getTime() >= new Date(latest.closesAt).getTime() ? rating : latest;
  }, null);
}

function liveEventPresentation(event: LiveMatchEvent, match: LiveMatchActivity) {
  const matchup = `${match.teamA.shortName} vs ${match.teamB.shortName}`;
  if (event.type === "kill") {
    return {
      badge: "LIVE" as const,
      kind: event.type,
      matchup,
      leftLabel: event.killerSummonerName ?? "선수",
      leftImageSrc: championImage(event.killerChampionId),
      rightLabel: event.victimSummonerName ?? "상대 선수",
      rightImageSrc: championImage(event.victimChampionId),
    };
  }

  const teamLabel = event.teamId === match.teamA.id
    ? match.teamA.shortName
    : event.teamId === match.teamB.id
      ? match.teamB.shortName
      : "경기";
  const dragon = event.dragonType ? DRAGON_PRESENTATION[event.dragonType.toLowerCase()] : undefined;
  const objectiveLabel = event.type === "baron"
    ? "바론"
    : event.type === "dragon"
      ? dragon?.label ?? "드래곤"
      : event.type === "tower"
        ? "포탑"
        : event.type === "inhibitor"
          ? "억제기"
          : "종료";
  const objectiveImage = event.type === "baron"
    ? OBJECTIVE_ICONS.baron
    : event.type === "dragon"
      ? dragon?.icon ?? OBJECTIVE_ICONS.dragon
      : event.type === "tower" || event.type === "inhibitor"
        ? OBJECTIVE_ICONS.tower
        : undefined;

  return {
    badge: "LIVE" as const,
    kind: event.type,
    matchup,
    leftLabel: event.type === "end" ? "세트" : teamLabel,
    rightLabel: objectiveLabel,
    rightImageSrc: objectiveImage,
  };
}

export function useMatchActivity(enabled: boolean, followedTeamIds: string[] = [], preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES) {
  const { showToast } = useToast();
  const [activity, setActivity] = useState<MatchActivityResponse>(EMPTY_ACTIVITY);
  const [ratingCard, setRatingCard] = useState<RatingMatchActivity | null>(null);
  const [liveCard, setLiveCard] = useState<LiveMatchActivity | null>(null);
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

  useEffect(() => {
    const current = parseNotifications(getNotificationsSnapshot());
    const next = current.filter((notification) => (
      !notification.id.includes("temporary-rating-card-preview")
      && !notification.id.includes("temporary-live-match-preview")
    ));
    if (next.length === current.length) return;
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
  }, []);

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

  const storeNotification = useCallback((notification: AppNotification) => {
    updateStoredNotifications((current) => current.some((item) => item.id === notification.id)
      ? current
      : [notification, ...current]);
  }, []);

  const dismissRatingCard = useCallback(() => {
    setRatingCard((current) => {
      if (!current) return null;
      const dismissed = dismissedRatingCardIds();
      dismissed.add(current.id);
      window.localStorage.setItem(DISMISSED_RATING_CARD_STORAGE_KEY, JSON.stringify([...dismissed].slice(-100)));
      return null;
    });
  }, []);

  const dismissLiveCard = useCallback(() => {
    setLiveCard((current) => {
      if (!current) return null;
      const dismissed = dismissedLiveCardIds();
      dismissed.add(current.id);
      window.localStorage.setItem(DISMISSED_LIVE_CARD_STORAGE_KEY, JSON.stringify([...dismissed].slice(-100)));
      return null;
    });
  }, []);

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
      const newestRating = preferences.inAppEnabled && preferences.ratingOpenEnabled
        ? latestRating(next.ratings)
        : null;

      setRatingCard(
        newestRating && !dismissedRatingCardIds().has(newestRating.id)
          ? newestRating
          : null,
      );

      if (initialized.current && preferences.inAppEnabled) {
        const followedLiveMatches = next.liveMatches.filter(
          (match) => followedTeamIdSet.has(match.teamA.id) || followedTeamIdSet.has(match.teamB.id),
        );
        for (const match of preferences.matchStartEnabled ? followedLiveMatches : []) {
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
            }, LIVE_NOTIFICATION_DURATION_MS);
          }
        }
        for (const rating of preferences.ratingOpenEnabled ? next.ratings : []) {
          if (!previousRatingIds.current.has(rating.id)) {
            storeNotification({
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
            });
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
      const newestLiveMatch = next.liveMatches[0] ?? null;
      setLiveCard(newestLiveMatch && !dismissedLiveCardIds().has(newestLiveMatch.id) ? newestLiveMatch : null);
      setActivity(next);
    } catch {
      // 전역 보조 UI이므로 네트워크 오류가 페이지 탐색을 막지 않게 조용히 유지한다.
    }
  }, [enabled, followedTeamIdSet, preferences.inAppEnabled, preferences.matchStartEnabled, preferences.ratingOpenEnabled, publishNotification, storeNotification]);

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
    if (!enabled || !preferences.inAppEnabled || !preferences.matchEventsEnabled || alertLiveMatches.length === 0) return;

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
            }, LIVE_NOTIFICATION_DURATION_MS);
          }
        } catch {
          // 라이브 피드가 잠시 끊겨도 다음 폴링에서 이어 받는다.
        }
      }));
    };

    void pollEvents();
    const interval = window.setInterval(() => void pollEvents(), LIVE_EVENT_POLL_MS);
    return () => window.clearInterval(interval);
  }, [alertLiveMatches, enabled, preferences.inAppEnabled, preferences.matchEventsEnabled, publishNotification]);

  const unreadNotificationCount = notifications.filter((notification) => !notification.readAt).length;

  return {
    activity,
    liveCard,
    dismissLiveCard,
    ratingCard,
    dismissRatingCard,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearNotifications,
    refresh: loadActivity,
  };
}
