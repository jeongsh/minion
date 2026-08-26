"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import CommunityEditor from "@/components/community/editor/community-editor";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { Button } from "@/components/ui/button";
import { createPostAction, updatePostAction } from "@/lib/community/actions";
import type { BoardDef, BoardScope } from "@/lib/community/boards";
import {
  getCommunityPostTextLength,
  POST_TEXT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "@/lib/community/limits";

function isEmptyDoc(json: string): boolean {
  try {
    const doc = JSON.parse(json) as unknown;
    let hasContent = false;
    const walk = (node: unknown) => {
      if (hasContent || !node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (
        typeof record.type === "string"
        && ["image", "imageResize", "youtube", "embed", "poll"].includes(record.type)
      ) {
        hasContent = true;
        return;
      }
      if (record.type === "text" && typeof record.text === "string" && record.text.trim()) {
        hasContent = true;
        return;
      }
      if (Array.isArray(record.content)) record.content.forEach(walk);
    };
    walk(doc);
    return !hasContent;
  } catch {
    return json.trim().length === 0;
  }
}

// 글 작성 폼 — 시안 3a + 4b(인라인 말머리). 정확값 동기화 버전.
export function PostForm({
  scope,
  categories,
  defaultCategory,
  teamId,
  teamSlug,
  postId,
  initialTitle = "",
  initialContent = "",
  canSetNotice = false,
  isGuest = false,
}: {
  scope: BoardScope;
  categories: BoardDef[];
  defaultCategory: string;
  teamId?: string | null;
  teamSlug?: string;
  postId?: string;
  initialTitle?: string;
  initialContent?: string;
  canSetNotice?: boolean;
  isGuest?: boolean;
}) {
  const router = useRouter();
  const { startNavigation } = useNavigationTransition();
  const [boardType, setBoardType] = useState(defaultCategory);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [contentTextLength, setContentTextLength] = useState(() => getCommunityPostTextLength(initialContent));
  const [isNotice, setIsNotice] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const boardPath =
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : `/community`;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setMessage("제목을 입력하세요.");
      return;
    }
    if (isEmptyDoc(content)) {
      setMessage("내용을 입력하세요.");
      return;
    }
    if (contentTextLength > POST_TEXT_MAX_LENGTH) {
      setMessage(`본문은 ${POST_TEXT_MAX_LENGTH.toLocaleString("ko-KR")}자까지 입력할 수 있습니다.`);
      return;
    }

    startTransition(async () => {
      const result = postId
        ? await updatePostAction({ postId, scope, boardType, teamSlug, title: title.trim(), content })
        : await createPostAction({ scope, boardType, teamId, teamSlug, title: title.trim(), content, isNotice });
      if (result.ok) {
        const destination = postId
          ? scope === "team" && teamSlug
            ? `/fan/${teamSlug}/community/post/${postId}`
            : `/community/post/${postId}`
          : boardPath;
        if (startNavigation(destination)) {
          router.push(destination);
        }
      } else {
        setMessage(result.error);
      }
    });
  };

  const categoryOptions = categories.map((category) => ({ value: category.slug, label: category.label }));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 md:gap-3">
      <Button
        type="submit"
        variant="primary"
        disabled={pending || contentTextLength > POST_TEXT_MAX_LENGTH}
        className="fixed right-3 top-1.5 z-[60] h-9 min-w-[58px] rounded-xl px-3 text-[14px] font-medium md:hidden"
      >
        {pending ? "등록 중" : postId ? "수정" : "등록"}
      </Button>
      {!postId && canSetNotice ? (
        <label className="flex items-center gap-2 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-[14px] font-medium text-[var(--ui-text)]">
          <input
            type="checkbox"
            checked={isNotice}
            onChange={(event) => setIsNotice(event.target.checked)}
            className="h-4 w-4 accent-[var(--ui-ink)]"
          />
          공지글로 등록
        </label>
      ) : null}
      <div className="flex flex-col gap-2 border-b border-[var(--ui-border)] pb-3">
        <div className="w-fit rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-1.5">
          <FilterDropdown
            ariaLabel="말머리 선택"
            options={categoryOptions}
            selected={boardType}
            onSelect={setBoardType}
            triggerClassName="min-h-9 px-2 text-[14px] font-medium sm:text-[14px]"
          />
          <input type="hidden" name="category" value={boardType} />
        </div>
        <label htmlFor="post-title" className="sr-only">
          제목
        </label>
        <input
          id="post-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={POST_TITLE_MAX_LENGTH}
          required
          placeholder="제목을 입력하세요"
          className="min-w-0 bg-transparent px-0 py-1 text-[16px] font-bold leading-[1.45] tracking-[-0.025em] text-[var(--ui-ink)] outline-none placeholder:font-medium placeholder:text-[#b8bcc4] md:text-[28px] md:leading-tight dark:placeholder:text-[#666b73]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="sr-only">내용</label>
        <CommunityEditor
          content={content}
          onChange={(nextContent) => {
            setContent(nextContent);
            setContentTextLength(getCommunityPostTextLength(nextContent));
          }}
          allowEmbeds={!isGuest}
          allowMedia
          maxImages={isGuest ? 1 : 10}
          placeholder="내용을 입력하세요"
        />
        <p className={`text-right text-[13px] tabular-nums ${contentTextLength > POST_TEXT_MAX_LENGTH ? "text-red-500" : "text-[var(--ui-muted)]"}`}>
          {contentTextLength.toLocaleString("ko-KR")}/{POST_TEXT_MAX_LENGTH.toLocaleString("ko-KR")}자
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        {message ? <p className="text-[13px] text-red-500">{message}</p> : null}
        <Button
          type="submit"
          variant="neutral"
          disabled={pending || contentTextLength > POST_TEXT_MAX_LENGTH}
          className="min-w-24 max-md:!hidden md:inline-flex"
        >
          {pending ? "등록 중" : postId ? "수정" : "등록"}
        </Button>
      </div>
    </form>
  );
}
