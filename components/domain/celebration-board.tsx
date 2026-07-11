"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { postCelebrationMessage } from "@/app/actions/celebration";
import type { CelebrationMessage } from "@/lib/calendar/events";

const MAX_LENGTH = 200;
const QUICK_EMOJIS = ["🎉", "🎂", "🥳", "💖", "🔥", "👏"];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CelebrationBoard({
  eventKey,
  title,
  isLoggedIn,
  initialMessages,
  accentColor,
}: {
  eventKey: string;
  title: string;
  isLoggedIn: boolean;
  initialMessages: CelebrationMessage[];
  accentColor?: string | null;
}) {
  const [messages, setMessages] = useState<CelebrationMessage[]>(initialMessages);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const accent = accentColor || "var(--ui-ink)";

  const appendEmoji = (emoji: string) =>
    setValue((prev) => (prev + emoji).slice(0, MAX_LENGTH));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await postCelebrationMessage({ eventKey, message: value });
      if (result.ok) {
        setMessages((prev) => [result.message, ...prev]);
        setValue("");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-black text-[var(--ui-ink)]">축하 메시지 보드</h3>
        <span className="text-[13px] font-bold text-[var(--ui-muted)]">
          {messages.length.toLocaleString("ko-KR")}개의 축하
        </span>
      </div>

      {isLoggedIn ? (
        <form onSubmit={onSubmit}>
          <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 focus-within:border-[var(--ui-muted)]">
            <label htmlFor={`celeb-${eventKey}`} className="sr-only">
              {title} 축하 메시지
            </label>
            <textarea
              id={`celeb-${eventKey}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={2}
              maxLength={MAX_LENGTH}
              required
              placeholder={`${title}을(를) 축하하는 한마디를 남겨보세요 🎉`}
              className="block w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => appendEmoji(emoji)}
                  className="grid h-8 w-8 place-items-center rounded-full text-base hover:bg-[var(--ui-surface-muted)]"
                  aria-label={`${emoji} 입력`}
                >
                  {emoji}
                </button>
              ))}
              {error ? <p className="text-[13px] text-[#ff3158]">{error}</p> : null}
              <span className="ml-auto text-[13px] tabular-nums text-[var(--ui-muted)]">
                {value.length}/{MAX_LENGTH}
              </span>
              <Button type="submit" disabled={pending || value.trim().length === 0} variant="secondary">
                {pending ? "등록 중" : "축하하기"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-3.5">
          <p className="text-sm font-semibold text-[var(--ui-muted)]">로그인하고 축하 메시지를 남겨보세요.</p>
          <Link
            href="/login"
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-black text-white"
            style={{ background: accent }}
          >
            로그인
          </Link>
        </div>
      )}

      {messages.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3">
              <p className="text-[15px] leading-relaxed text-[var(--ui-text)]">{m.message}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ui-muted)]">
                <span className="text-[var(--ui-ink)]">{m.authorName ?? "익명의 팬"}</span>
                <span aria-hidden>·</span>
                <span>{formatWhen(m.createdAt)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-[var(--ui-surface-muted)] py-8 text-center text-sm text-[var(--ui-muted)]">
          첫 번째 축하 메시지를 남겨주세요! 🎈
        </p>
      )}
    </div>
  );
}
