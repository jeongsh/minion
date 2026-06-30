"use client";

import { useEditor, EditorContent } from "@tiptap/react";

import { buildCommunityExtensions } from "./community-extensions";
import { useEmbedHydration } from "./use-embed-hydration";

// 본문 렌더러. TipTap JSON 을 읽기 전용 에디터로 렌더링하고,
// JSON 이 아닌 레거시 평문은 그대로 표시한다.
export function PostContentViewer({ content }: { content: string }) {
  let docContent: unknown = null;
  let isJson = false;
  try {
    docContent = JSON.parse(content);
    isJson = !!docContent && typeof docContent === "object";
  } catch {
    isJson = false;
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: buildCommunityExtensions(),
    content: isJson ? (docContent as object) : content,
    editorProps: {
      attributes: {
        class: "community-prose max-w-none text-sm leading-7 md:text-base",
      },
    },
  });

  useEmbedHydration(editor);

  if (!isJson) {
    // 레거시 평문 호환.
    return <div className="whitespace-pre-wrap text-sm leading-relaxed md:text-base">{content}</div>;
  }

  return <EditorContent editor={editor} />;
}
