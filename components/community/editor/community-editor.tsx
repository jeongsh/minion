"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useState } from "react";

import Toolbar from "./Toolbar";
import { buildCommunityExtensions } from "./community-extensions";
import { useEmbedHydration } from "./use-embed-hydration";
import { MAX_EDITOR_VIDEOS, getImageUploadErrorMessage, isEditorVideoFile, uploadEditorImage, uploadEditorVideo } from "./editor-image-upload";
import { MediaUploadPlaceholder, createMediaUploadPlaceholder, mediaInsertionPosition, mediaUploadKey } from "./media-upload-placeholder";
import type { MiniconPack } from "@/lib/minicons/types";
import { getPostImageLimitMessage, POST_IMAGE_MAX_COUNT } from "@/lib/community/limits";

interface Props {
  content: string;
  onChange: (content: string) => void;
  allowMedia?: boolean;
  allowEmbeds?: boolean;
  maxImages?: number;
  placeholder?: string;
  miniconPacks?: MiniconPack[];
}

export default function CommunityEditor({ content, onChange, allowMedia = true, allowEmbeds = allowMedia, maxImages = POST_IMAGE_MAX_COUNT, placeholder, miniconPacks = [] }: Props) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...buildCommunityExtensions({ placeholder: placeholder ?? "내용을 입력하세요" }), MediaUploadPlaceholder],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "community-prose max-w-none min-h-[calc(100svh-250px)] px-0 py-4 text-base leading-7 focus:outline-none md:min-h-[520px] md:py-3",
      },
      handlePaste: (view, event) => {
        if (!allowMedia || !editor) return false;
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) return false;

        event.preventDefault();
        void uploadEditorMedia(files, view.state.selection.to);
        return true;
      },
      handleDrop: (view, event) => {
        if (!allowMedia || !editor) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/") || isEditorVideoFile(file));
        if (files.length === 0) return false;

        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadEditorMedia(files, position ?? view.state.selection.to);
        return true;
      },
    },
  });

  const uploadEditorMedia = async (files: File[], position: number) => {
    if (!editor || files.length === 0 || mediaUploadKey.getState(editor.state)) return;
    if (!allowEmbeds && files.some(isEditorVideoFile)) {
      alert("동영상은 로그인 후 첨부할 수 있습니다.");
      return;
    }
    let imageCount = 0;
    let videoCount = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "image" || node.type.name === "imageResize") imageCount += 1;
      if (node.type.name === "video") videoCount += 1;
    });
    const remainingImages = Math.max(0, maxImages - imageCount);
    const remainingVideos = Math.max(0, MAX_EDITOR_VIDEOS - videoCount);
    const imageFiles = files.filter((file) => !isEditorVideoFile(file));
    const videoFiles = files.filter(isEditorVideoFile);
    if (imageFiles.length > remainingImages) alert(getPostImageLimitMessage(maxImages, remainingImages));
    if (videoFiles.length > remainingVideos) alert(`동영상은 ${MAX_EDITOR_VIDEOS}개까지 첨부할 수 있습니다.`);
    const queue = new Set([...imageFiles.slice(0, remainingImages), ...videoFiles.slice(0, remainingVideos)]);
    if (queue.size === 0) return;
    setUploadingImage(true);
    try {
      for (const file of files) {
        if (!queue.has(file)) continue;
        const isVideo = isEditorVideoFile(file);
        const type = isVideo ? "video" : "imageResize";
        const preview = createMediaUploadPlaceholder();
        editor.view.dispatch(editor.state.tr.setMeta(mediaUploadKey, { position, type }));
        const onSize = (size: { width: number; height: number }) => {
          const current = mediaUploadKey.getState(editor.state);
          if (!current || editor.isDestroyed) return;
          preview.setSize(size);
          editor.view.dispatch(editor.state.tr.setMeta(mediaUploadKey, { ...current, placeholder: preview.element }));
        };
        const media = isVideo
          ? await uploadEditorVideo(file, onSize, preview.setProgress)
          : await uploadEditorImage(file, onSize);
        const current = mediaUploadKey.getState(editor.state);
        if (!current || editor.isDestroyed) return;

        const selection = editor.state.selection;
        const atUpload = selection.to === current.position;
        const target = mediaInsertionPosition(editor.state.doc, current.position, editor.schema.nodes[type]);
        const chain = editor.chain();
        if (atUpload) chain.focus();
        chain
          .insertContentAt(target, media)
          .command(({ tr }) => {
            position = tr.selection.to;
            if (!atUpload) tr.setSelection(selection.map(tr.doc, tr.mapping));
            tr.setMeta(mediaUploadKey, { position, type });
            return true;
          })
          .run();
      }
    } catch (error) {
      alert("업로드 실패: " + getImageUploadErrorMessage(error, "알 수 없는 오류"));
    } finally {
      if (!editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta(mediaUploadKey, null));
        setUploadingImage(false);
      }
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
    <div className="community-editor relative flex flex-col bg-transparent md:bg-[var(--ui-surface)]">
      <EditorContent editor={editor} />
      <Toolbar editor={editor} allowEmbeds={allowEmbeds} allowMedia={allowMedia} maxImages={maxImages} miniconPacks={miniconPacks} uploadingImage={uploadingImage} onUpload={uploadEditorMedia} />
    </div>
  );
}
