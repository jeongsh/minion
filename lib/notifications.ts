export type NotificationKind =
  | "match_live"
  | "match_event"
  | "rating_open"
  | "team_video"
  | "team_social"
  | "player_live"
  | "post_activity";

export type NotificationPreferences = {
  inAppEnabled: boolean;
  communityEnabled: boolean;
  matchStartEnabled: boolean;
  matchEventsEnabled: boolean;
  ratingOpenEnabled: boolean;
  teamContentEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  communityEnabled: true,
  matchStartEnabled: true,
  matchEventsEnabled: false,
  ratingOpenEnabled: true,
  teamContentEnabled: true,
};

export type TeamNotificationPreferences = {
  teamId: string;
  teamName: string;
  teamShortName: string;
  matchAlertsEnabled: boolean;
  liveMatchAlertsEnabled: boolean;
  instagramAlertsEnabled: boolean;
  videoAlertsEnabled: boolean;
  soloQueueAlertsEnabled: boolean;
};

export type MatchEventPresentation = {
  badge: "LIVE" | "평가";
  kind: "kill" | "tower" | "baron" | "inhibitor" | "dragon" | "end" | "start" | "rating";
  matchup: string;
  leftLabel?: string;
  leftImageSrc?: string;
  rightLabel: string;
  rightImageSrc?: string;
};

/**
 * 알림함이 경기 기능에 종속되지 않도록 만든 공용 표시 모델.
 * 이후 서버 알림 테이블을 붙일 때도 이 형태로 내려주면 UI를 그대로 재사용할 수 있다.
 */
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description?: string;
  href?: string;
  imageUrl?: string | null;
  createdAt: string;
  readAt: string | null;
  matchEvent?: MatchEventPresentation;
};
