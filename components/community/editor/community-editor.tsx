"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Toolbar from "./Toolbar";
import { buildCommunityExtensions } from "./community-extensions";
import { useEmbedHydration } from "./use-embed-hydration";
import { getImageUploadErrorMessage, uploadAndInsertEditorImage } from "./editor-image-upload";
import type { MiniconPack } from "@/lib/minicons/types";

interface Props {
  content: string;
  onChange: (content: string) => void;
  allowMedia?: boolean;
  allowEmbeds?: boolean;
  maxImages?: number;
  placeholder?: string;
  miniconPacks?: MiniconPack[];
}

export default function CommunityEditor({ content, onChange, allowMedia = true, allowEmbeds = allowMedia, maxImages = 10, placeholder, miniconPacks = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uploadingDropImage, setUploadingDropImage] = useState(false);
  const [uploadingToolbarImage, setUploadingToolbarImage] = useState(false);
  const uploadingImage = uploadingDropImage || uploadingToolbarImage;

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
    let imageCount = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "image" || node.type.name === "imageResize") imageCount += 1;
    });
    const remaining = Math.max(0, maxImages - imageCount);
    if (remaining === 0) {
      alert(`이미지는 ${maxImages}장까지 첨부할 수 있습니다.`);
      return;
    }
    setUploadingDropImage(true);
    try {
      for (const file of files.slice(0, remaining)) {
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
      {uploadingImage ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex min-h-28 items-center justify-center gap-3 rounded-xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-surface)_94%,transparent)] px-4 shadow-sm" role="status" aria-live="polite">
          <LoaderCircle className="animate-spin text-[var(--accent)]" size={24} aria-hidden="true" />
          <div>
            <p className="text-[14px] font-medium text-[var(--ui-ink)]">이미지를 올리는 중이에요</p>
            <p className="mt-0.5 text-[13px] font-normal text-[var(--ui-muted)]">완료되면 이 위치에 이미지가 표시됩니다.</p>
          </div>
        </div>
      ) : null}
      <EditorContent editor={editor} />
      <Toolbar editor={editor} allowEmbeds={allowEmbeds} allowMedia={allowMedia} maxImages={maxImages} miniconPacks={miniconPacks} onUploadingChange={setUploadingToolbarImage} />
    </div>
  );
}
