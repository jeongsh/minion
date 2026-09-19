import { Node } from "@tiptap/core";
import { contentUrl } from "@/lib/community/read-only-content";

/** Preserve imported video attachments when an existing post is edited. */
export const VideoExtension = Node.create({
  name: "video", group: "block", atom: true,
  addAttributes() { return { src: { default: null, parseHTML: element => contentUrl(element.getAttribute("src")) } }; },
  parseHTML() { return [{ tag: "video[src]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["video", { src: contentUrl(HTMLAttributes.src) ?? "", controls: "", playsinline: "", preload: "metadata", class: "my-4 max-h-[640px] w-full rounded" }];
  },
});
