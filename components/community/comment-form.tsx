"use client";

import { SendHorizontal, Sticker, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GuestIdentityFields } from "@/components/community/guest-identity-fields";
import { MiniconPickerPanel, rememberMiniconUse } from "@/components/community/minicon-picker";
import { createCommentAction, createMiniconCommentAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import type { MiniconItem, MiniconPack } from "@/lib/minicons/types";
import { useCommentMaxLength } from "@/components/community/use-comment-max-length";

export function CommentForm({
  postId,
  scope,
  teamSlug,
  parentId,
  onSubmitted,
  isGuest = false,
  variant = "default",
  miniconPacks = [],
}: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
  parentId?: string;
  onSubmitted?: () => void;
  isGuest?: boolean;
  variant?: "default" | "mobileDock";
  miniconPacks?: MiniconPack[];
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [miniconOpen, setMiniconOpen] = useState(false);
  const [selectedMinicons, setSelectedMinicons] = useState<MiniconItem[]>([]);
  const [doubleMode, setDoubleMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = useCommentMaxLength();

  const toggleMiniconPanel = () => {
    if (!miniconOpen) inputRef.current?.blur();
    setMiniconOpen((open) => !open);
  };

  const submitMinicons = (items: MiniconItem[]) => {
    if (pending) return;
    setContent("");
    setMiniconOpen(false);
    setSelectedMinicons([]);
    startTransition(async () => {
      const result = await createMiniconCommentAction({
        postId,
        miniconItemIds: items.map((item) => item.id),
        parentId,
        scope,
        teamSlug,
      });
      if (result.ok) {
        items.forEach((item) => rememberMiniconUse(item.id));
        setMessage(null);
        showToast({ title: parentId ? "답글 등록 완료" : "댓글 등록 완료", tone: "success" });
        onSubmitted?.();
        window.setTimeout(() => router.refresh(), 0);
      } else {
        setMessage(result.error);
        showToast({ title: "등록 실패", description: result.error, tone: "error" });
      }
    });
  };

  const selectMinicon = (item: MiniconItem) => {
    if (doubleMode) {
      if (selectedMinicons.length === 0) {
        setSelectedMinicons([item]);
        setContent("");
        return;
      }
      submitMinicons([selectedMinicons[0], item]);
      return;
    }
    submitMinicons([item]);
  };

  const startDoubleMinicon = (item: MiniconItem) => {
    setDoubleMode(true);
    setSelectedMinicons([item]);
    setContent("");
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCommentAction({
        postId,
        content,
        parentId,
        scope,
        teamSlug,
      });
      if (result.ok) {
        setContent("");
        setMessage(null);
        showToast({
          title: parentId ? "답글 등록 완료" : "댓글 등록 완료",
          description: isGuest ? "비회원 댓글이 등록됐어요." : "+20 LP가 적립됐어요.",
          tone: "success",
        });
        onSubmitted?.();
        window.setTimeout(() => router.refresh(), 0);
      } else {
        setMessage(result.error);
        showToast({ title: "등록 실패", description: result.error, tone: "error" });
      }
    });
  };

  if (variant === "mobileDock") {
    return (
      <form
        onSubmit={onSubmit}
        className="border-t border-[var(--ui-border)] bg-[var(--page-background)] px-2.5 pb-[calc(.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,.08)] focus-within:pb-2"
      >
        <label htmlFor={`comment-content-${parentId ?? "root"}-dock`} className="sr-only">
          {parentId ? "답글 작성" : "댓글 작성"}
        </label>
        {message ? <p className="mb-1 px-2 text-[13px] text-red-500">{message}</p> : null}
        <div className="flex items-center gap-1.5">
          <div className="flex min-h-10 min-w-0 flex-1 items-center rounded-[20px] bg-[var(--ui-surface-muted)] px-3.5 py-1.5">
            {selectedMinicons.length > 0 ? (
              <div className="relative h-10 w-10 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedMinicons[0].imageUrl} alt={`${selectedMinicons[0].name} 미니콘`} className="h-10 w-10 object-cover" />
                <button type="button" onClick={() => setSelectedMinicons([])} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-sm" aria-label="선택한 미니콘 취소"><X size={13} strokeWidth={2} /></button>
              </div>
            ) : (
              <textarea
                ref={inputRef}
                id={`comment-content-${parentId ?? "root"}-dock`}
                name="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={1}
                maxLength={maxLength}
                required
                placeholder="댓글을 입력해 주세요."
                className="max-h-20 min-h-6 min-w-0 flex-1 resize-none border-0 bg-transparent py-0 text-[14px] leading-6 text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
              />
            )}
            <div className="relative shrink-0">
              <button type="button" onClick={toggleMiniconPanel} className={`grid h-7 w-7 place-items-center rounded-full ${miniconOpen || selectedMinicons.length > 0 ? "text-[var(--tp)]" : "text-[var(--ui-muted)]"}`} aria-label="미니콘 선택" aria-expanded={miniconOpen}>
                <Sticker size={19} strokeWidth={1.7} />
              </button>
              {miniconOpen ? <MiniconPickerPanel packs={miniconPacks} selectedIds={selectedMinicons.map((item) => item.id)} onSelect={selectMinicon} doubleMode={doubleMode} onDoubleModeChange={(enabled) => { setDoubleMode(enabled); setSelectedMinicons([]); }} onStartDouble={startDoubleMinicon} mobile /> : null}
            </div>
          </div>
          <button type="submit" disabled={pending || selectedMinicons.length > 0 || content.trim().length === 0 || content.length > maxLength} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--tp)] disabled:text-[var(--ui-muted)]" aria-label={pending ? "댓글 등록 중" : "댓글 등록"}>
            <SendHorizontal size={22} strokeWidth={2} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label
        htmlFor={`comment-content-${parentId ?? "root"}`}
        className="sr-only"
      >
        {parentId ? "답글 작성" : "댓글 작성"}
      </label>
      <div className="rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
        {isGuest ? (
          <div className="mb-4">
            <GuestIdentityFields compact />
          </div>
        ) : null}
        {selectedMinicons.length > 0 ? (
          <div className="relative h-24 w-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedMinicons[0].imageUrl} alt={`${selectedMinicons[0].packName} ${selectedMinicons[0].name}`} className="h-24 w-24 object-cover" />
            <button type="button" onClick={() => setSelectedMinicons([])} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-sm" aria-label="선택한 미니콘 취소"><X size={16} strokeWidth={2} /></button>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            id={`comment-content-${parentId ?? "root"}`}
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                event.ctrlKey &&
                !event.nativeEvent.isComposing &&
                !pending &&
                content.trim().length > 0
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={parentId ? 3 : 4}
            maxLength={maxLength}
            required
            placeholder="댓글을 입력해 주세요."
            className="block w-full resize-none border-0 bg-transparent p-0 text-base leading-7 text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
          />
        )}
        <div className="mt-3 flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={toggleMiniconPanel}
              className={`grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--ui-surface-muted)] ${miniconOpen || selectedMinicons.length > 0 ? "text-[var(--tp)]" : "text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}
              aria-label="미니콘 선택"
              aria-expanded={miniconOpen}
            >
              <Sticker size={20} strokeWidth={1.6} />
            </button>
            {miniconOpen ? <MiniconPickerPanel packs={miniconPacks} selectedIds={selectedMinicons.map((item) => item.id)} onSelect={selectMinicon} doubleMode={doubleMode} onDoubleModeChange={(enabled) => { setDoubleMode(enabled); setSelectedMinicons([]); }} /> : null}
          </div>
          {message ? (
            <p className="text-[13px] text-[var(--ui-muted)]">{message}</p>
          ) : null}
          {selectedMinicons.length === 0 ? <span className="ml-auto text-[13px] tabular-nums text-[var(--ui-muted)]">{content.length.toLocaleString("ko-KR")}/{maxLength.toLocaleString("ko-KR")}자</span> : <span className="ml-auto" />}
          <Button
            type="submit"
            disabled={pending || selectedMinicons.length > 0 || content.trim().length === 0 || content.length > maxLength}
            variant="secondary"
          >
            {pending ? "등록 중" : "등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}
