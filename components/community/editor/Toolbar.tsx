"use client";

import { type Editor } from "@tiptap/react";
import {
  BarChart3,
  Bold,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Redo,
  Share2,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Undo,
  Video,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { FilterDropdown } from "@/components/match-filter-dropdown";

import { ColorPicker } from "./ColorPicker";
import { getImageUploadErrorMessage, uploadAndInsertEditorImage } from "./editor-image-upload";

interface Props {
  editor: Editor | null;
  allowMedia?: boolean;
}

type OpenPanel = "format" | "youtube" | "sns" | null;
type SavedSelection = { from: number; to: number } | null;

export default function Toolbar({ editor, allowMedia = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedColorSelection = useRef<SavedSelection>(null);
  const savedHighlightSelection = useRef<SavedSelection>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [embedUrl, setEmbedUrl] = useState("");

  if (!editor) return null;

  const saveSelection = (ref: React.MutableRefObject<SavedSelection>) => {
    const { from, to } = editor.state.selection;
    ref.current = { from, to };
  };

  const applyWithSelection = (
    ref: React.MutableRefObject<SavedSelection>,
    command: (chain: ReturnType<Editor["chain"]>) => boolean,
  ) => {
    const saved = ref.current;
    const chain = editor.chain().focus();
    if (saved && saved.from !== saved.to) chain.setTextSelection(saved);
    command(chain);
  };

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    setEmbedUrl("");
    setOpenPanel((current) => current === panel ? null : panel);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploadingImage(true);
    try {
      for (const file of files) await uploadAndInsertEditorImage({ editor, file });
    } catch (error) {
      alert("이미지 업로드 실패: " + getImageUploadErrorMessage(error, "알 수 없는 오류"));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertYoutube = () => {
    const value = embedUrl.trim();
    const match = value.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
    const videoId = match?.[1] ?? (value.length === 11 && !value.includes("/") ? value : "");
    if (!videoId) return;
    editor.chain().focus().setYoutubeVideo({ src: `https://www.youtube.com/embed/${videoId}` }).run();
    setEmbedUrl("");
    setOpenPanel(null);
  };

  const insertSns = () => {
    const url = embedUrl.trim();
    if (!url) return;
    let type = "generic";
    if (url.includes("twitter.com") || url.includes("x.com")) type = "twitter";
    if (url.includes("instagram.com")) type = "instagram";
    editor.chain().focus().insertContent({ type: "embed", attrs: { url, type } }).run();
    setEmbedUrl("");
    setOpenPanel(null);
  };

  const formatButtonClass = (active = false) =>
    `grid h-10 w-10 shrink-0 place-items-center rounded-lg transition ${active
      ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]"
      : "text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]"}`;

  const primaryButtonClass = (active = false) =>
    `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0 text-[13px] font-medium transition ${active
      ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--ui-surface))] text-[var(--accent)]"
      : "text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]"}`;

  const fontSize = editor.getAttributes("textStyle").fontSize || "16px";
  const fontSizeOptions = ["13px", "14px", "16px", "18px", "20px", "24px", "32px"].map((value) => ({
    value,
    label: value.replace("px", ""),
  }));

  const closePanel = () => {
    setOpenPanel(null);
    setEmbedUrl("");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-y border-[var(--ui-border)] bg-[var(--ui-surface)] pb-[env(safe-area-inset-bottom)] md:static md:order-first md:mb-2 md:rounded-lg md:border md:border-[var(--ui-border)] md:pb-0">
      {openPanel === "format" ? (
        <div className="absolute inset-x-2 bottom-[calc(100%+10px)] flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-xl sm:left-auto sm:right-2 sm:w-auto">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={formatButtonClass(editor.isActive("bold"))} aria-label="굵게"><Bold size={18} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={formatButtonClass(editor.isActive("italic"))} aria-label="기울임"><Italic size={18} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={formatButtonClass(editor.isActive("underline"))} aria-label="밑줄"><UnderlineIcon size={18} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={formatButtonClass(editor.isActive("strike"))} aria-label="취소선"><Strikethrough size={18} /></button>
          <span className="mx-1 h-6 w-px bg-[var(--ui-border)]" aria-hidden="true" />
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={formatButtonClass(editor.isActive("bulletList"))} aria-label="글머리 목록"><List size={18} /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={formatButtonClass(editor.isActive("orderedList"))} aria-label="번호 목록"><ListOrdered size={18} /></button>
          <ColorPicker value={editor.getAttributes("textStyle").color || "#000000"} onChange={(color) => applyWithSelection(savedColorSelection, (chain) => chain.setColor(color).run())} onBeforeCustomPick={() => saveSelection(savedColorSelection)} icon={<Type size={16} />} quickSetLabel="기본 글자색" quickSetValue="#000000" />
          <ColorPicker value={editor.getAttributes("highlight").color || "transparent"} onChange={(color) => color === "transparent" ? applyWithSelection(savedHighlightSelection, (chain) => chain.unsetHighlight().run()) : applyWithSelection(savedHighlightSelection, (chain) => chain.setHighlight({ color }).run())} onBeforeCustomPick={() => saveSelection(savedHighlightSelection)} icon={<Highlighter size={16} />} quickSetLabel="배경색 제거" quickSetValue="transparent" />
          <button type="button" onClick={closePanel} className={`${formatButtonClass()} ml-auto`} aria-label="서식 도구 닫기"><X size={18} /></button>
        </div>
      ) : null}

      {openPanel === "youtube" || openPanel === "sns" ? (
        <div className="absolute inset-x-2 bottom-[calc(100%+10px)] rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 shadow-xl sm:left-auto sm:right-2 sm:w-[420px]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium text-[var(--ui-ink)]">{openPanel === "youtube" ? "YouTube 영상 넣기" : "SNS 게시물 넣기"}</p>
            <button type="button" onClick={closePanel} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" aria-label="닫기"><X size={17} /></button>
          </div>
          <div className="flex gap-2">
            <input autoFocus value={embedUrl} onChange={(event) => setEmbedUrl(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); if (openPanel === "youtube") insertYoutube(); else insertSns(); }} placeholder={openPanel === "youtube" ? "YouTube URL을 붙여넣으세요" : "Instagram 또는 X URL을 붙여넣으세요"} className="min-w-0 flex-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[14px] text-[var(--ui-ink)] outline-none focus:border-[var(--ui-muted)]" />
            <button type="button" onClick={openPanel === "youtube" ? insertYoutube : insertSns} disabled={!embedUrl.trim()} className="h-10 rounded-xl bg-[var(--ui-ink)] px-4 text-[14px] font-medium text-[var(--ui-surface)] disabled:opacity-40">넣기</button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-12 items-center justify-center overflow-x-auto px-1.5 py-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {allowMedia ? (
          <>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className={primaryButtonClass()} aria-label={uploadingImage ? "이미지 업로드 중" : "이미지 첨부"}><ImageIcon size={18} /></button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" multiple />
            <button type="button" onClick={() => togglePanel("youtube")} className={primaryButtonClass(openPanel === "youtube")} aria-label="YouTube 영상 첨부"><Video size={18} /></button>
            <button type="button" onClick={() => togglePanel("sns")} className={primaryButtonClass(openPanel === "sns")} aria-label="SNS 게시물 첨부"><Share2 size={18} /></button>
            <button type="button" onClick={() => editor.chain().focus().insertPoll().run()} className={primaryButtonClass()} aria-label="투표 추가"><BarChart3 size={18} /></button>
          </>
        ) : null}
        <button type="button" onClick={() => togglePanel("format")} className={primaryButtonClass(openPanel === "format")} aria-label="텍스트 서식"><span className="text-[16px] font-medium leading-none">Aa</span></button>
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--ui-border)]" aria-hidden="true" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={`${primaryButtonClass()} disabled:opacity-30`} aria-label="실행 취소"><Undo size={18} /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={`${primaryButtonClass()} disabled:opacity-30`} aria-label="다시 실행"><Redo size={18} /></button>
      </div>

      <div className="hidden min-h-12 items-center gap-0.5 overflow-x-auto px-2 py-1 md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={formatButtonClass(editor.isActive("bold"))} aria-label="굵게"><Bold size={18} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={formatButtonClass(editor.isActive("italic"))} aria-label="기울임"><Italic size={18} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={formatButtonClass(editor.isActive("underline"))} aria-label="밑줄"><UnderlineIcon size={18} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={formatButtonClass(editor.isActive("strike"))} aria-label="취소선"><Strikethrough size={18} /></button>
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--ui-border)]" aria-hidden="true" />
        <ColorPicker value={editor.getAttributes("textStyle").color || "#000000"} onChange={(color) => applyWithSelection(savedColorSelection, (chain) => chain.setColor(color).run())} onBeforeCustomPick={() => saveSelection(savedColorSelection)} icon={<Type size={16} />} quickSetLabel="기본 글자색" quickSetValue="#000000" />
        <ColorPicker value={editor.getAttributes("highlight").color || "transparent"} onChange={(color) => color === "transparent" ? applyWithSelection(savedHighlightSelection, (chain) => chain.unsetHighlight().run()) : applyWithSelection(savedHighlightSelection, (chain) => chain.setHighlight({ color }).run())} onBeforeCustomPick={() => saveSelection(savedHighlightSelection)} icon={<Highlighter size={16} />} quickSetLabel="배경색 제거" quickSetValue="transparent" />
        <div className="rounded-lg px-0.5">
          <FilterDropdown ariaLabel="글자 크기" options={fontSizeOptions} selected={fontSize} onSelect={(value) => editor.chain().focus().setFontSize(value).run()} triggerClassName="min-h-9 px-1.5 text-[13px] font-medium sm:text-[13px]" />
        </div>
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--ui-border)]" aria-hidden="true" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={formatButtonClass(editor.isActive("bulletList"))} aria-label="글머리 목록"><List size={18} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={formatButtonClass(editor.isActive("orderedList"))} aria-label="번호 목록"><ListOrdered size={18} /></button>

        {allowMedia ? (
          <>
            <span className="mx-1 h-6 w-px shrink-0 bg-[var(--ui-border)]" aria-hidden="true" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className={formatButtonClass()} aria-label="이미지 첨부"><ImageIcon size={18} /></button>
            <button type="button" onClick={() => togglePanel("youtube")} className={formatButtonClass(openPanel === "youtube")} aria-label="YouTube 영상 첨부"><Video size={18} /></button>
            <button type="button" onClick={() => togglePanel("sns")} className={formatButtonClass(openPanel === "sns")} aria-label="SNS 게시물 첨부"><Share2 size={18} /></button>
            <button type="button" onClick={() => editor.chain().focus().insertPoll().run()} className={formatButtonClass()} aria-label="투표 추가"><BarChart3 size={18} /></button>
          </>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
          <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={`${formatButtonClass()} disabled:opacity-30`} aria-label="실행 취소"><Undo size={18} /></button>
          <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={`${formatButtonClass()} disabled:opacity-30`} aria-label="다시 실행"><Redo size={18} /></button>
        </div>
      </div>
    </div>
  );
}
