import { Node, mergeAttributes } from "@tiptap/core";

// 트위터(X)/인스타그램/일반 링크 임베드를 위한 블록 노드.
// 본문에는 blockquote 마크업만 저장하고, 뷰어/에디터에서 외부 위젯 스크립트를 로드해 하이드레이션한다.
export const EmbedExtension = Node.create({
  name: "embed",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      type: {
        default: "generic", // 'twitter', 'instagram', 'generic'
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-embed-url]",
        getAttrs: (element) => {
          if (typeof element === "string") return null;
          return {
            url: element.getAttribute("data-embed-url"),
            type: element.getAttribute("data-embed-type"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const baseAttrs = {
      "data-embed-url": HTMLAttributes.url,
      "data-embed-type": HTMLAttributes.type,
    };

    if (HTMLAttributes.type === "twitter") {
      const attrs = mergeAttributes(HTMLAttributes, {
        ...baseAttrs,
        class: "embed-block my-4",
      });

      return [
        "div",
        attrs,
        ["blockquote", { class: "twitter-tweet" }, ["a", { href: HTMLAttributes.url }, HTMLAttributes.url || "X post"]],
      ];
    }

    if (HTMLAttributes.type === "instagram") {
      const attrs = mergeAttributes(HTMLAttributes, {
        ...baseAttrs,
        class: "embed-block my-4",
      });
      return [
        "div",
        attrs,
        [
          "blockquote",
          {
            class: "instagram-media",
            "data-instgrm-permalink": HTMLAttributes.url,
            "data-instgrm-version": "14",
          },
          ["a", { href: HTMLAttributes.url }, HTMLAttributes.url || "Instagram post"],
        ],
      ];
    }

    const attrs = mergeAttributes(HTMLAttributes, {
      ...baseAttrs,
      class: "embed-block my-4 rounded border border-border bg-surface-muted p-3",
    });

    return [
      "div",
      attrs,
      ["a", { href: HTMLAttributes.url, target: "_blank", rel: "noopener noreferrer" }, HTMLAttributes.url || "Embedded link"],
    ];
  },
});
