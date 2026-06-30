"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import CommunityEditor from "@/components/community/editor/community-editor";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { createPostAction } from "@/lib/community/actions";
import type { BoardDef, BoardScope } from "@/lib/community/boards";

// 본문이 비었는지(빈 문단/공백만) 판별.
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

// 글 작성 폼 — 시안 3a + 4b. 말머리를 제목 입력칸 왼쪽에 인라인으로 붙인 한 줄 구성.
// 색상은 토큰만 사용 → 팀 프라이머리(--accent)를 그대로 따른다.
export function PostForm({
  scope,
  categories,
  defaultCategory,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  categories: BoardDef[];
  defaultCategory: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  const router = useRouter();
  const { startNavigation } = useNavigationTransition();
  const [boardType, setBoardType] = useState(defaultCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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
      const result = await createPostAction({
        scope,
        boardType,
        teamId,
        teamSlug,
        title: title.trim(),
        content,
      });
      if (result.ok) {
        if (startNavigation(boardPath)) {
          router.push(boardPath);
        }
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* 말머리(좌) + 제목(우) 인라인 한 줄 */}
      <div className="flex items-stretch overflow-hidden rounded-lg border border-border focus-within:border-accent">
        <div className="relative flex items-center border-r border-border bg-surface-muted">
          <label htmlFor="post-category" className="sr-only">
            말머리
          </label>
          <select
            id="post-category"
            name="category"
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            className="appearance-none bg-transparent py-3 pl-3.5 pr-8 text-sm font-semibold text-accent outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-xs text-accent/60" aria-hidden>
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
          className="min-w-0 flex-1 bg-surface px-3.5 py-3 text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="sr-only">내용</label>
        <CommunityEditor content={content} onChange={setContent} placeholder="내용을 입력하세요" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">서로 존중하는 커뮤니티를 위해 비방·욕설은 삼가주세요.</p>
        <div className="flex items-center gap-2">
          {message ? <p className="text-sm text-muted">{message}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            등록
          </button>
        </div>
      </div>
    </form>
  );
}
