"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import CommunityEditor from "@/components/community/editor/community-editor";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { Button } from "@/components/ui/button";
import { createPostAction, updatePostAction } from "@/lib/community/actions";
import type { BoardDef, BoardScope } from "@/lib/community/boards";

function isEmptyDoc(json: string): boolean {
  try {
    const doc = JSON.parse(json) as unknown;
    let hasContent = false;
    const walk = (node: unknown) => {
      if (hasContent || !node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (typeof record.type === "string" && ["image", "imageResize", "youtube", "embed"].includes(record.type)) {
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
}: {
  scope: BoardScope;
  categories: BoardDef[];
  defaultCategory: string;
  teamId?: string | null;
  teamSlug?: string;
  postId?: string;
  initialTitle?: string;
  initialContent?: string;
}) {
  const router = useRouter();
  const { startNavigation } = useNavigationTransition();
  const [boardType, setBoardType] = useState(defaultCategory);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
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

    startTransition(async () => {
      const result = postId
        ? await updatePostAction({ postId, scope, boardType, teamSlug, title: title.trim(), content })
        : await createPostAction({ scope, boardType, teamId, teamSlug, title: title.trim(), content });
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* 말머리(좌) + 제목(우) 인라인 한 줄 */}
      <div className="flex items-stretch overflow-hidden rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] focus-within:border-[var(--ui-ink)]">
        <div className="relative flex items-center border-r border-[var(--ui-border)] bg-[var(--ui-surface-muted)]">
          <label htmlFor="post-category" className="sr-only">
            말머리
          </label>
          <select
            id="post-category"
            name="category"
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            className="appearance-none bg-transparent py-[10px] pl-[13px] pr-8 text-m font-semibold text-[var(--ui-text)] outline-none"
          >
            {categories.map((cat) => (
              <option
                key={cat.slug}
                value={cat.slug}
                className="bg-[var(--ui-surface)] text-[var(--ui-text)]"
              >
                {cat.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-[11px] text-[13px] text-[var(--ui-muted)]" aria-hidden>
            ▾
          </span>
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
          required
          placeholder="제목을 입력하세요"
          className="min-w-0 flex-1 bg-[var(--ui-surface)] px-[13px] py-[10px] text-base font-semibold text-[var(--ui-ink)] outline-none placeholder:font-normal placeholder:text-[var(--ui-muted)]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="sr-only">내용</label>
        <CommunityEditor content={content} onChange={setContent} placeholder="내용을 입력하세요" />
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-3 sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:p-0">
        <p className="text-[12px] text-[var(--ui-muted)] sm:text-[13px]">서로 존중하는 커뮤니티를 위해 비방·욕설은 삼가주세요.</p>
        <div className="flex items-center justify-end gap-2">
          {message ? <p className="text-[13px] text-[var(--ui-muted)]">{message}</p> : null}
          <Button
            type="submit"
            variant="neutral"
            disabled={pending}
            className="min-w-24"
          >
            {postId ? "수정" : "등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}
