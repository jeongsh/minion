"use client";

import { Send, Timer } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createFanOnionAction } from "@/app/fan/[teamSlug]/actions";
import type { FanOnionItem, FanTemperatureSnapshot } from "@/lib/data/fan-pulse";

const MAX_LENGTH = 100;
const PROFANITY_PATTERNS = [
  /씨\s*발|시\s*발|ㅅ\s*ㅂ|ㅆ\s*ㅂ/gi,
  /병\s*신|븅\s*신|ㅂ\s*ㅅ/gi,
  /개\s*새\s*끼|개\s*새|개\s*자\s*식/gi,
  /좆|존\s*나|졸\s*라|지\s*랄|꺼\s*져/gi,
  /fuck|shit|bitch|asshole/gi,
];

const RETENTION_OPTIONS = [
  { label: "5분", value: 5 },
  { label: "15분", value: 15 },
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
] as const;

function maskProfanity(value: string) {
  return PROFANITY_PATTERNS.reduce(
    (next, pattern) => next.replace(pattern, (match) => "＊".repeat(Math.max(2, match.length))),
    value,
  );
}

export function FanOnionBoard({
  teamId,
  teamSlug,
  teamName,
  teamColor,
  initialOnions,
  initialSnapshot,
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  teamColor: string;
  initialOnions: FanOnionItem[];
  initialSnapshot: FanTemperatureSnapshot;
}) {
  const [content, setContent] = useState("");
  const [retentionMinutes, setRetentionMinutes] = useState(5);
  const [onions, setOnions] = useState(initialOnions);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeOnions = useMemo(
    () => onions.filter((item) => new Date(item.expiresAt).getTime() > now),
    [now, onions],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createFanOnionAction({
        teamId,
        teamSlug,
        content,
        retentionMinutes,
      });

      if (result.ok) {
        setContent("");
        if (result.onions) setOnions(result.onions);
        if (result.snapshot) setSnapshot(result.snapshot);
        setMessage(`${retentionMinutes}분 뒤 화면에서 사라져요.`);
        return;
      }

      setMessage(result.error ?? "양파를 남기지 못했어요.");
    });
  }

  function handleContentChange(value: string) {
    setContent(maskProfanity(value).slice(0, MAX_LENGTH));
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (isPending || content.trim().length === 0) return;
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <section className="flex min-h-[calc(100vh-260px)] flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[#f4f2ee]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3">
        <div className="min-w-0">
          <p className="font-archivo text-xs font-black uppercase tracking-[0.18em] text-[var(--ui-muted)]">
            Onion Board
          </p>
          <h1 className="truncate text-xl font-black text-[var(--ui-ink)]">{teamName} 비난양파</h1>
        </div>
        <div className="shrink-0 text-right text-xs font-bold text-[var(--ui-muted)]">
          <span className="block text-sm font-black" style={{ color: teamColor }}>
            {snapshot.score}℃
          </span>
          <span>{activeOnions.length.toLocaleString("ko-KR")}개 표시 중</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto px-3 py-4">
        {activeOnions.length ? (
          activeOnions.map((item) => <OnionBubble key={item.id} item={item} now={now} />)
        ) : (
          <div className="grid flex-1 place-items-center text-sm font-bold text-[var(--ui-muted)]">
            아직 까인 양파가 없습니다.
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 py-1.5"
      >
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="fan-onion-retention">
            보존 시간
          </label>
          <select
            id="fan-onion-retention"
            value={retentionMinutes}
            onChange={(event) => setRetentionMinutes(Number(event.target.value))}
            className="h-9 shrink-0 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 text-xs font-black text-[var(--ui-ink)] outline-none"
          >
            {RETENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5">
            <textarea
              value={content}
              onChange={(event) => handleContentChange(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="Enter 전송 · Shift+Enter 줄바꿈"
              className="max-h-16 min-h-5 flex-1 resize-none bg-transparent text-sm font-bold leading-5 text-[var(--ui-ink)] outline-none placeholder:text-[var(--ui-muted)]"
            />
            <span className="ml-2 shrink-0 text-[11px] font-bold text-[var(--ui-muted)]">
              {content.length}/{MAX_LENGTH}
            </span>
          </div>

          <button
            type="submit"
            disabled={isPending || content.trim().length === 0}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition active:scale-[0.97] disabled:opacity-50"
            style={{ background: teamColor }}
            aria-label="비난양파 남기기"
          >
            <Send size={17} />
          </button>
        </div>
        {message ? <p className="mt-1 px-2 text-xs font-bold text-[var(--ui-muted)]">{message}</p> : null}
      </form>
    </section>
  );
}

function OnionBubble({ item, now }: { item: FanOnionItem; now: number }) {
  const remainingSeconds = Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - now) / 1000));
  const minute = Math.floor(remainingSeconds / 60);
  const second = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <article className="flex justify-start" data-onion-bubble="true">
      <div className="inline-flex max-w-[82%] flex-wrap items-baseline gap-x-2 rounded-2xl rounded-bl-md bg-white px-3 py-1.5 shadow-sm">
        <p className="min-w-0 whitespace-pre-wrap break-words text-sm font-bold leading-5 text-[var(--ui-ink)]">
          {item.content}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black leading-5 text-[var(--ui-muted)]">
          <Timer size={12} />
          {minute}:{second}
        </span>
      </div>
    </article>
  );
}
