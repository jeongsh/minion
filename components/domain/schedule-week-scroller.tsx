"use client";

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
  return (
    <div className="grid grid-cols-7 gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-1">
      {dates.map((date) => {
        const isToday = date.key === todayKey;
        const targetKey = targetForDate(date.key, availableDateKeys);

        return (
          <a
            key={date.key}
            href={targetKey ? `#${DAY_SECTION_PREFIX}-${targetKey}` : undefined}
            data-navigation-ignore
            aria-current={isToday ? "date" : undefined}
            className={`flex min-h-11 flex-col items-center justify-center rounded-lg text-[11px] font-bold transition-colors ${
              isToday
                ? "bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-sm"
                : "text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"
            }`}
            onClick={(event) => {
              if (!targetKey) return;

              event.preventDefault();
              const target = document.getElementById(`${DAY_SECTION_PREFIX}-${targetKey}`);
              if (!target) return;

              history.pushState(null, "", `#${DAY_SECTION_PREFIX}-${targetKey}`);
              smoothScrollToElement(target);
            }}
          >
            <span>{date.weekday}</span>
            <span className="text-[14px] font-black">{date.day}</span>
          </a>
        );
      })}
    </div>
  );
}
