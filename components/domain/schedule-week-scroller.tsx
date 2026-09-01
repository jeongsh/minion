"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DAY_SECTION_PREFIX = "schedule-day";

type WeekDate = {
  key: string;
  day: number;
  weekday: string;
};

function targetForDate(dateKey: string, availableDateKeys: string[]) {
  if (availableDateKeys.includes(dateKey)) {
    return dateKey;
  }

  return availableDateKeys.find((key) => key >= dateKey) ?? availableDateKeys.at(-1);
}

function smoothScrollToElement(target: HTMLElement) {
  const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
  const startY = window.scrollY;
  const targetY = Math.max(0, target.getBoundingClientRect().top + startY - scrollMarginTop);
  const distance = targetY - startY;
  const duration = 360;
  const startTime = performance.now();

  if (Math.abs(distance) < 2) return;

  function tick(now: number) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

export function ScheduleWeekScroller({
  dates,
  todayKey,
  availableDateKeys,
}: {
  dates: WeekDate[];
  todayKey: string;
  availableDateKeys: string[];
}) {
  const initialActiveDateKey = useMemo(
    () => targetForDate(todayKey, availableDateKeys) ?? dates[0]?.key,
    [availableDateKeys, dates, todayKey],
  );
  const [requestedActiveDateKey, setRequestedActiveDateKey] = useState<string>();
  const activeDateKey = requestedActiveDateKey && availableDateKeys.includes(requestedActiveDateKey)
    ? requestedActiveDateKey
    : initialActiveDateKey;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const updateWidth = () => setViewportWidth(scroller.clientWidth);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scroller);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateActiveDate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const firstSection = availableDateKeys.length > 0
          ? document.getElementById(`${DAY_SECTION_PREFIX}-${availableDateKeys[0]}`)
          : null;
        const sectionScrollMargin = firstSection
          ? Number.parseFloat(window.getComputedStyle(firstSection).scrollMarginTop) || 0
          : 0;
        const threshold = Math.max((scrollerRef.current?.getBoundingClientRect().bottom ?? 0) + 8, sectionScrollMargin + 1);
        let next = availableDateKeys[0];

        for (const key of availableDateKeys) {
          const section = document.getElementById(`${DAY_SECTION_PREFIX}-${key}`);
          if (!section) continue;
          if (section.getBoundingClientRect().top <= threshold) next = key;
          else break;
        }

        if (next) setRequestedActiveDateKey(next);
      });
    };

    updateActiveDate();
    window.addEventListener("scroll", updateActiveDate, { passive: true });
    window.addEventListener("resize", updateActiveDate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveDate);
      window.removeEventListener("resize", updateActiveDate);
    };
  }, [availableDateKeys]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const cell = activeDateKey ? cellRefs.current.get(activeDateKey) : undefined;
    if (!scroller || !cell) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const left = scroller.scrollLeft + cellRect.left - scrollerRect.left - (scroller.clientWidth - cellRect.width) / 2;
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollTo({ behavior: "smooth", left: Math.min(maxLeft, Math.max(0, left)) });
  }, [activeDateKey, viewportWidth]);

  return (
    <div
      ref={scrollerRef}
      aria-label="날짜 이동"
      className="flex touch-pan-x gap-1 overflow-x-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {dates.map((date) => {
        const isActive = date.key === activeDateKey;
        const isToday = date.key === todayKey;
        const targetKey = targetForDate(date.key, availableDateKeys);

        return (
          <a
            key={date.key}
            ref={(node) => {
              if (node) cellRefs.current.set(date.key, node);
              else cellRefs.current.delete(date.key);
            }}
            href={targetKey ? `#${DAY_SECTION_PREFIX}-${targetKey}` : undefined}
            data-navigation-ignore
            aria-current={isActive ? "date" : undefined}
            aria-label={`${date.day}일 ${date.weekday}요일${isToday ? ", 오늘" : ""}`}
            style={{ width: viewportWidth > 0 ? (viewportWidth - 34) / 7 : 44 }}
            className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-lg text-[13px] font-medium transition-colors ${
              isActive
                ? "bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-sm"
                : `text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] ${isToday ? "ring-1 ring-inset ring-[var(--ui-ink)]" : ""}`
            }`}
            onClick={(event) => {
              if (!targetKey) return;

              event.preventDefault();
              const target = document.getElementById(`${DAY_SECTION_PREFIX}-${targetKey}`);
              if (!target) return;

              history.pushState(null, "", `#${DAY_SECTION_PREFIX}-${targetKey}`);
              setRequestedActiveDateKey(targetKey);
              smoothScrollToElement(target);
            }}
          >
            <span>{date.weekday}</span>
            <span className="text-[14px] font-medium">{date.day}</span>
          </a>
        );
      })}
    </div>
  );
}
