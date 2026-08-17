"use client";

import Link from "next/link";
import { Bell, CheckCheck, MessageCircle, Radio, Star, Trash2, UserRound, Video, X } from "lucide-react";

import type { AppNotification, NotificationKind } from "@/lib/notifications";

function NotificationTypeIcon({ kind }: { kind: NotificationKind }) {
  if (kind === "match_live" || kind === "match_event") return <Radio size={17} />;
  if (kind === "rating_open") return <Star size={17} />;
  if (kind === "team_video") return <Video size={17} />;
  if (kind === "player_live") return <UserRound size={17} />;
  if (kind === "post_activity") return <MessageCircle size={17} />;
  return <Bell size={17} />;
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function NotificationRow({
  notification,
  onRead,
  onRemove,
  onClose,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const eventImage = notification.matchEvent?.rightImageSrc ?? notification.matchEvent?.leftImageSrc;
  const imageUrl = notification.imageUrl ?? eventImage;
  const useObjectiveMask = Boolean(
    eventImage
    && (notification.matchEvent?.kind === "tower" || notification.matchEvent?.kind === "inhibitor"),
  );
  const content = (
    <>
      <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--ui-card-bg)] text-[var(--ui-muted)]">
        {imageUrl && useObjectiveMask ? (
          <span
            aria-hidden="true"
            className="h-5 w-5 bg-[var(--ui-muted)]"
            style={{
              WebkitMaskImage: `url(${imageUrl})`,
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
              maskImage: `url(${imageUrl})`,
              maskPosition: "center",
              maskRepeat: "no-repeat",
              maskSize: "contain",
            }}
          />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className={notification.matchEvent?.kind === "kill" ? "h-full w-full object-cover" : "h-5 w-5 object-contain"} />
        ) : <NotificationTypeIcon kind={notification.kind} />}
        {!notification.readAt ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start py-1">
        <span className={`text-[12px] leading-4 ${notification.readAt ? "font-semibold text-[var(--ui-muted)]" : "font-black text-[var(--ui-ink)]"}`}>{notification.title}</span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-[var(--ui-muted)]">
          {notification.description ? <span>{notification.description}</span> : null}
          <time dateTime={notification.createdAt} className="shrink-0 font-medium">{relativeTime(notification.createdAt)}</time>
        </span>
      </span>
    </>
  );

  return (
    <div className={`flex min-h-12 items-center gap-1 rounded-lg border px-2 py-1 transition ${notification.readAt ? "border-transparent bg-transparent" : "border-[var(--ui-border)] bg-[var(--ui-surface)]"}`}>
      {notification.href ? (
        <Link href={notification.href} onClick={() => { onRead(notification.id); onClose(); }} className="flex min-w-0 flex-1 items-center gap-2 rounded-md">{content}</Link>
      ) : (
        <button type="button" onClick={() => onRead(notification.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left">{content}</button>
      )}
      <button type="button" onClick={() => onRemove(notification.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]" aria-label={`${notification.title} 알림 삭제`}><X size={15} /></button>
    </div>
  );
}

export function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onRead,
  onReadAll,
  onRemove,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!open) return null;

  return (
    <div className="notification-panel-root fixed inset-0 z-[1000] min-[1200px]:pointer-events-none" role="presentation">
      <button type="button" className="notification-panel-backdrop modal-backdrop absolute inset-0 bg-black/35 [--modal-backdrop-dark-mobile:0.55] min-[1200px]:hidden" onClick={onClose} aria-label="알림 닫기" />
      <section role="dialog" aria-modal="true" aria-labelledby="notification-panel-title" className="notification-panel-dialog absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col overflow-hidden rounded-t-[24px] border border-[var(--ui-border)] bg-[var(--page-background)] shadow-2xl min-[1200px]:pointer-events-auto min-[1200px]:left-auto min-[1200px]:right-4 min-[1200px]:top-20 min-[1200px]:bottom-auto min-[1200px]:w-[390px] min-[1200px]:max-h-[calc(100vh-6rem)] min-[1200px]:rounded-2xl">
        <header className="flex min-h-14 items-center gap-1 border-b border-[var(--ui-border)] px-3 min-[1200px]:px-4">
          <h2 id="notification-panel-title" className="font-paperozi mr-auto text-[15px] tracking-[-0.02em]">알림</h2>
          {unreadCount > 0 ? <button type="button" onClick={onReadAll} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"><CheckCheck size={15} />모두 읽음</button> : null}
          {notifications.length > 0 ? <button type="button" onClick={onClear} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"><Trash2 size={15} />비우기</button> : null}
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)]" aria-label="닫기"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 md:p-3 min-[1200px]:p-4">
          {notifications.length > 0 ? (
            <div className="space-y-1 min-[1200px]:space-y-1.5">
              {notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} onRead={onRead} onRemove={onRemove} onClose={onClose} />)}
            </div>
          ) : (
            <div className="px-3 py-12 text-center min-[1200px]:py-14">
              <Bell className="mx-auto text-[var(--ui-muted)]" size={23} />
              <p className="mt-2 text-[15px] font-bold text-[var(--ui-ink)]">새 알림이 없습니다</p>
              <p className="mt-1 text-[13px] text-[var(--ui-muted)]">새 소식이 도착하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
