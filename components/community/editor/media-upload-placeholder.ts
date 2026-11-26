import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode, NodeType } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { insertPoint } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

interface MediaUpload {
  position: number;
  type: "imageResize" | "video";
  placeholder?: HTMLElement;
}

export const mediaUploadKey = new PluginKey<MediaUpload | null>("communityMediaUpload");

export const MediaUploadPlaceholder = Extension.create({
  name: "communityMediaUpload",
  addProseMirrorPlugins() {
    return [new Plugin<MediaUpload | null>({
      key: mediaUploadKey,
      state: {
        init: () => null,
        apply(transaction, upload) {
          const next = transaction.getMeta(mediaUploadKey) as MediaUpload | null | undefined;
          if (next !== undefined) return next;
          if (!upload || !transaction.docChanged) return upload;
          return { ...upload, position: transaction.mapping.map(upload.position, -1) };
        },
      },
      props: {
        decorations(state) {
          const upload = mediaUploadKey.getState(state);
          if (!upload?.placeholder) return null;
          const position = mediaInsertionPosition(state.doc, upload.position, state.schema.nodes[upload.type]);
          return DecorationSet.create(state.doc, [Decoration.widget(position, upload.placeholder, { side: -1 })]);
        },
      },
    })];
  },
});

export function mediaInsertionPosition(
  doc: ProseMirrorNode,
  position: number,
  type: NodeType,
) {
  const { parent } = doc.resolve(position);
  // Tiptap replaces an empty paragraph when inserting a block into it.
  if (parent.isTextblock && !parent.type.spec.code && parent.childCount === 0) return position;
  return insertPoint(doc, position, type) ?? position;
}

export function createMediaUploadPlaceholder() {
  const element = document.createElement("span");
  element.className = "community-media-placeholder pointer-events-none my-3 block max-w-full";
  element.setAttribute("role", "status");
  element.setAttribute("aria-label", "업로드 중");

  const spinner = document.createElement("span");
  spinner.className = "community-media-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const progress = document.createElement("span");
  progress.className = "absolute inset-x-0 top-[calc(50%+22px)] text-center text-[13px] font-medium tabular-nums text-[var(--ui-text)]";
  progress.setAttribute("aria-hidden", "true");
  element.append(spinner, progress);

  return {
    element,
    setSize({ width, height }: { width: number; height: number }) {
      element.style.width = `${width}px`;
      element.style.aspectRatio = `${width} / ${height}`;
    },
    setProgress(percent: number) {
      element.setAttribute("aria-label", `업로드 ${percent}%`);
      progress.textContent = `${percent}%`;
    },
  };
}
