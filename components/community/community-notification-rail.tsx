"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useRelativeDateLabel } from "@/components/community/relative-date";
import { focusNotificationComment, useNotifications } from "@/components/notifications/notification-context";

const PAGE_SIZE = 5;

function NotificationPreview({ description = "", createdAt }: { description?: string; createdAt: string }) {
  const label = useRelativeDateLabel(createdAt);
  const content = description.replace(/\s+/g, " ").trim();
  const [fitted, setFitted] = useState(content);
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const measureTextRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    const text = measureTextRef.current;
    if (!container || !measure || !text) return;
    let active = true;
    const fit = () => {
      if (!active || container.clientWidth === 0) return;
      const fits = (value: string) => {
        text.textContent = value;
        return measure.getBoundingClientRect().height <= 32;
      };
      if (fits(content)) { setFitted(content); return; }
      const characters = Array.from(content);
      let low = 0;
      let high = characters.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(`${characters.slice(0, middle).join("").trimEnd()}…`)) low = middle;
        else high = middle - 1;
      }
      setFitted(`${characters.slice(0, low).join("").trimEnd()}…`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    void document.fonts.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [content, label]);

  return <span ref={containerRef} className="relative block max-h-8 overflow-hidden text-[12px] font-normal leading-4 [overflow-wrap:anywhere]">
    <span className="transition-opacity group-hover:opacity-75">{fitted}</span><time dateTime={createdAt} className="ml-1 inline-block whitespace-nowrap text-[var(--ui-muted)]">{label}</time>
    <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 w-full">
      <span ref={measureTextRef}>{content}</span><span className="ml-1 inline-block whitespace-nowrap">{label}</span>
    </span>
  </span>;
}

export function CommunityNotificationRail() {
  const { notifications, onRead, onRemove, onClear } = useNotifications();
  const [page, setPage] = useState(0);
  const activity = notifications.filter(item => item.activityKind === "post_comment" || item.activityKind === "comment_reply");
  const lastPage = Math.max(0, Math.ceil(activity.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = activity.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const controlClass = "min-h-10 px-2 text-[13px] font-medium text-[var(--ui-muted)] disabled:opacity-40";

  return (
    <section className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]" aria-labelledby="community-notifications-title">
      <div className="flex h-10 items-center justify-between border-b border-[var(--ui-border)] pl-4 pr-2">
        <h2 id="community-notifications-title" className="home-section-title text-[16px] text-[var(--ui-ink)]">내 알림</h2>
        <button type="button" className={controlClass} disabled={activity.length === 0} onClick={onClear}>모두 삭제</button>
      </div>
        {activity.length > 0 ? <>
          <ul className="divide-y divide-[var(--ui-border)] px-4">
            {visible.map(item => <li key={item.id} className="flex items-center gap-1 py-1">
              <Link href={item.href!} onClick={(event) => { onRead(item.id); if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && focusNotificationComment(item.href)) event.preventDefault(); }} className="group min-w-0 flex-1 text-[var(--ui-ink)]">
                <span className={`block ${item.readAt ? "opacity-55" : ""}`}>
                  <NotificationPreview description={item.description} createdAt={item.createdAt} />
                </span>
              </Link>
              <button type="button" className="grid h-10 w-10 shrink-0 place-items-center text-[var(--ui-muted)]" aria-label={`${item.title} 알림 삭제`} onClick={() => onRemove(item.id)}><X size={16} /></button>
            </li>)}
          </ul>
        </> : <p className="px-4 py-3 text-[12px] leading-4 text-[var(--ui-muted)]">받은 알림이 없습니다.</p>}
        <nav aria-label="알림 페이지 이동" className="flex items-center justify-between border-t border-[var(--ui-border)] px-2 text-[13px] text-[var(--ui-muted)]">
          <button type="button" className={`flex items-center gap-1 ${controlClass}`} disabled={currentPage === 0} aria-label="이전 알림" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} />이전</button>
          <span className="tabular-nums">{currentPage + 1} / {lastPage + 1}</span>
          <button type="button" className={`flex items-center gap-1 ${controlClass}`} disabled={currentPage === lastPage} aria-label="다음 알림" onClick={() => setPage(currentPage + 1)}>다음<ChevronRight size={16} /></button>
        </nav>
    </section>
  );
}
