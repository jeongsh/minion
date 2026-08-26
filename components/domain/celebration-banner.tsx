import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  celebrationBoardHref,
  celebrationWriteHref,
  type CalendarEvent,
} from "@/lib/calendar/events";
import { CALENDAR_EVENT_BANNER_THEME } from "@/lib/calendar/theme";

const TYPE_EMOJI: Record<CalendarEvent["type"], string> = {
  birthday: "🎂",
  debut: "🎉",
  championship: "🏆",
  custom: "🎈",
};

/** 배너를 누르면 갈 곳. board=팀 게시판, write=축하글 작성 폼. */
export type CelebrationAction = "board" | "write";

/** 윗줄 — 무슨 날인지. */
function eyebrow(event: CalendarEvent) {
  if (event.type === "birthday") {
    const nth = event.yearsCount ? `${event.yearsCount}번째 ` : "";
    return `오늘은 ${event.subjectName} 선수의 ${nth}생일!`;
  }
  return `오늘은 ${event.title}!`;
}

/** 아랫줄 — 어디서 뭘 하면 되는지. */
function headline(event: CalendarEvent, action: CelebrationAction) {
  if (action === "write") return "축하 글을 남겨주세요";
  const where = event.teamShort ?? event.teamName;
  return where ? `${where} 커뮤니티에서 함께 축하해요` : "커뮤니티에서 함께 축하해요";
}

function CelebrationCard({ event, action }: { event: CalendarEvent; action: CelebrationAction }) {
  const href = action === "write" ? celebrationWriteHref(event) : celebrationBoardHref(event);
  const ctaLabel = action === "write" ? "축하글 쓰기" : "축하하러 가기";
  const theme = CALENDAR_EVENT_BANNER_THEME[event.type];

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl px-4 py-3 transition sm:justify-center sm:gap-5 sm:px-6 sm:py-3.5"
      style={{ background: theme.background }}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-lg sm:h-10 sm:w-10"
        style={{ background: theme.soft }}
      >
        {event.playerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.playerImageUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          TYPE_EMOJI[event.type]
        )}
      </span>

      <span className="min-w-0 flex-1 sm:flex-initial">
        <span
          className="block truncate text-[13px] leading-4 sm:text-sm sm:leading-5"
          style={{ color: theme.accent }}
        >
          {eyebrow(event)}
        </span>
        <span className="block font-paperozi truncate text-sm sm:text-base" style={{ color: theme.foreground }}>
          {headline(event, action)}
        </span>
      </span>

      <span
        className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white px-2.5 py-2 text-[13px] font-bold sm:px-3.5"
        style={{ color: theme.background }}
      >
        <span className="hidden sm:inline">{ctaLabel}</span>
        <ChevronRight size={14} strokeWidth={2.5} />
      </span>
    </Link>
  );
}

/**
 * 오늘의 기념일 배너.
 * 홈/팬홈에서는 팀 게시판으로 보내고, 게시판 상단에서는 축하글 작성으로 보낸다.
 */
export function CelebrationBanner({
  events,
  action = "board",
}: {
  events: CalendarEvent[];
  action?: CelebrationAction;
}) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {events.map((event) => (
        <CelebrationCard key={event.key} event={event} action={action} />
      ))}
    </div>
  );
}
