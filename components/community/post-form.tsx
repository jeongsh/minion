"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import CommunityEditor from "@/components/community/editor/community-editor";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { createPostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

// 본문이 비었는지(빈 문단/공백만) 판별. 텍스트가 있거나 이미지/영상/임베드 노드가 있으면 내용 있음.
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

// 글 작성 폼. 작성 성공 시 보드 목록으로 이동.
export function PostForm({
  scope,
  boardType,
  boardLabel,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  boardType: string;
  boardLabel: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  const router = useRouter();
  const { startNavigation } = useNavigationTransition();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const boardPath =
    scope === "team" && teamSlug
      ? `/fan/${teamSlug}/community/${boardType}`
      : `/community/${boardType}`;

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
      <div className="flex flex-col gap-1">
        <label htmlFor="post-title" className="text-sm font-semibold">
          제목
        </label>
        <input
          id="post-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder={`${boardLabel} 게시판 글 제목`}
          className="w-full rounded-md border border-border bg-surface p-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">내용</label>
        <CommunityEditor content={content} onChange={setContent} placeholder="내용을 입력하세요" />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
        >
          작성
        </button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
    </form>
  );
}
