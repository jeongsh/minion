"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

import Toolbar from "./Toolbar";
import { buildCommunityExtensions } from "./community-extensions";
import { useEmbedHydration } from "./use-embed-hydration";
import { getImageUploadErrorMessage, uploadAndInsertEditorImage } from "./editor-image-upload";

interface Props {
  content: string;
  onChange: (content: string) => void;
  allowMedia?: boolean;
  placeholder?: string;
}

export default function CommunityEditor({ content, onChange, allowMedia = true, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uploadingDropImage, setUploadingDropImage] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildCommunityExtensions({ placeholder: placeholder ?? "내용을 입력하세요" }),
    content: content,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "community-prose max-w-none min-h-[calc(100svh-250px)] px-0 py-4 text-base leading-7 focus:outline-none md:min-h-[520px] md:py-3",
      },
      handlePaste: (_view, event) => {
        if (!allowMedia || !editor) return false;
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) return false;

        event.preventDefault();
        void uploadEditorImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        if (!allowMedia || !editor) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) return false;

        event.preventDefault();
        void uploadEditorImages(files);
        return true;
      },
    },
  });

  const uploadEditorImages = async (files: File[]) => {
    if (!editor || files.length === 0) return;
    setUploadingDropImage(true);
    try {
      for (const file of files) {
        await uploadAndInsertEditorImage({ editor, file });
      }
    } catch (error) {
      alert("이미지 업로드 실패: " + getImageUploadErrorMessage(error, "알 수 없는 오류"));
    } finally {
      setUploadingDropImage(false);
    }
  };

  useEmbedHydration(editor);

  // 외부에서 content 가 바뀔 때(초기 로드 등) 반영.
  useEffect(() => {
    if (!editor) return;

    try {
      const currentJson = JSON.stringify(editor.getJSON());
      if (content && content !== currentJson) {
        editor.commands.setContent(JSON.parse(content));
      }
    } catch {
      // JSON 이 아닌 경우(레거시 평문) 호환.
      if (content && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  return (
    <div ref={containerRef} className="community-editor relative flex flex-col bg-transparent md:bg-[var(--ui-surface)]">
      {uploadingDropImage ? (
        <div className="border-b border-border bg-surface-muted px-4 py-2 text-[13px] text-muted">이미지 업로드 중...</div>
      ) : null}
      <EditorContent editor={editor} />
      <Toolbar editor={editor} allowMedia={allowMedia} />
    </div>
  );
}
