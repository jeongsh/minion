"use client";

import { useRef, useState, useTransition } from "react";

import { createCommentAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

// 댓글 작성 폼. 비로그인 시 서버 액션이 로그인 유도 메시지를 돌려준다.
export function CommentForm({
  postId,
  scope,
  teamSlug,
}: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = String(new FormData(event.currentTarget).get("content") ?? "");

    startTransition(async () => {
      const result = await createCommentAction({ postId, content, scope, teamSlug });
      if (result.ok) {
        setMessage(result.message ?? "등록되었습니다.");
        formRef.current?.reset();
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="comment-content" className="sr-only">
        댓글
      </label>
      <textarea
        id="comment-content"
        name="content"
        rows={3}
        required
        placeholder="댓글을 입력하세요"
        className="w-full rounded-md border border-border bg-surface p-3 text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
        >
          댓글 등록
        </button>
        {message ? <p className="text-xs text-muted">{message}</p> : null}
      </div>
    </form>
  );
}
