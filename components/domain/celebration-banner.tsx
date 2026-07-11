"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { CalendarEvent, CelebrationMessage } from "@/lib/calendar/events";
import { CelebrationBoard } from "@/components/domain/celebration-board";

const TYPE_EMOJI: Record<CalendarEvent["type"], string> = {
  birthday: "🎂",
  debut: "🎉",
  championship: "🏆",
  custom: "🎈",
};

export type CelebrationBannerItem = {
  event: CalendarEvent;
  messages: CelebrationMessage[];
};

function headline(event: CalendarEvent) {
  const emoji = TYPE_EMOJI[event.type];
  if (event.type === "birthday") {
    const age = event.yearsCount ? ` (${event.yearsCount}번째 생일)` : "";
    return `${emoji} 오늘은 ${event.subjectName} 선수의 생일이에요!${age}`;
  }
  const years = event.yearsCount && event.yearsCount > 0 ? `${event.yearsCount}주년 ` : "";
  return `${emoji} 오늘은 ${event.title} ${years}기념일이에요!`;
}

function BannerCard({ item, isLoggedIn }: { item: CelebrationBannerItem; isLoggedIn: boolean }) {
  const { event } = item;
  const [open, setOpen] = useState(false);
  const accent = event.teamColor || "#ff3f7f";
  const avatar = event.type === "birthday" ? event.playerImageUrl : event.playerImageUrl ?? event.teamLogoUrl;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--ui-border)]"
      style={{ background: `linear-gradient(100deg, ${accent}1a, ${accent}05)` }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full text-2xl"
          style={{ background: `${accent}22` }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            TYPE_EMOJI[event.type]
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: accent }}>
            Today&apos;s Celebration
          </p>
          <p className="mt-0.5 truncate text-[15px] font-black text-[var(--ui-ink)] sm:text-base">{headline(event)}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-black text-white transition hover:opacity-90"
          style={{ background: accent }}
          aria-expanded={open}
        >
          {open ? "닫기" : "축하하기"}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-4">
          <CelebrationBoard
            eventKey={event.key}
            title={event.title}
            isLoggedIn={isLoggedIn}
            initialMessages={item.messages}
            accentColor={accent}
          />
        </div>
      ) : null}
    </div>
  );
}

export function CelebrationBanner({
  items,
  isLoggedIn,
}: {
  items: CelebrationBannerItem[];
  isLoggedIn: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <BannerCard key={item.event.key} item={item} isLoggedIn={isLoggedIn} />
      ))}
    </div>
  );
}
