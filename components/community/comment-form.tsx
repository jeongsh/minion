"use client";

import { Smile } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GuestIdentityFields } from "@/components/community/guest-identity-fields";
import { createCommentAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import { useCommentMaxLength } from "@/components/community/use-comment-max-length";

const EMOJIS = ["😀", "😂", "😍", "😮", "😢", "😡", "👍", "👏", "🔥", "🎉"];

export function CommentForm({
  postId,
  scope,
  teamSlug,
  parentId,
  onSubmitted,
  isGuest = false,
}: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
  parentId?: string;
  onSubmitted?: () => void;
  isGuest?: boolean;
}) {
  const { showToast } = useToast();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = useCommentMaxLength();

  const appendEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const next =
      `${content.slice(0, start)}${emoji}${content.slice(end)}`.slice(
        0,
        maxLength,
      );
    setContent(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
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
      } else {
        setMessage(result.error);
        showToast({ title: "등록 실패", description: result.error, tone: "error" });
      }
    });
  };

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
        <textarea
          ref={textareaRef}
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
        <div className="mt-3 flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
              aria-label="이모지 선택"
              aria-expanded={emojiOpen}
            >
              <Smile size={20} strokeWidth={1.6} />
            </button>
            {emojiOpen ? (
              <div className="absolute bottom-10 left-0 z-10 grid w-[184px] grid-cols-5 gap-1 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-lg">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => appendEmoji(emoji)}
                    className="grid h-8 w-8 place-items-center rounded hover:bg-[var(--ui-surface-muted)]"
                    aria-label={`${emoji} 입력`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {message ? (
            <p className="text-[13px] text-[var(--ui-muted)]">{message}</p>
          ) : null}
          <span className="ml-auto text-[13px] tabular-nums text-[var(--ui-muted)]">
            {content.length.toLocaleString("ko-KR")}/{maxLength.toLocaleString("ko-KR")}자
          </span>
          <Button
            type="submit"
            disabled={pending || content.trim().length === 0 || content.length > maxLength}
            variant="secondary"
          >
            {pending ? "등록 중" : "등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}
