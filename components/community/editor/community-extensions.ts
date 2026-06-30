import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { Youtube } from "@tiptap/extension-youtube";
import ResizeImage from "tiptap-extension-resize-image";
import type { Extensions } from "@tiptap/react";

import { FontSize } from "./extensions/FontSize";
import { EmbedExtension } from "./extensions/EmbedExtension";

/**
 * multicolor 기본값이 mark 에 `color: inherit` 를 넣어 textStyle 색이 가려지는 경우가 있어
 * 배경색만 적용하도록 덮어쓴다.
 */
const HighlightNoTextInherit = Highlight.extend({
  addAttributes() {
    if (!this.options.multicolor) {
      return {};
    }
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-color") || element.style.backgroundColor,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }
          return {
            "data-color": attributes.color,
            style: `background-color: ${attributes.color}`,
          };
        },
      },
    };
  },
});

// 작성 에디터와 본문 뷰어가 동일한 노드/마크 스키마를 공유하도록 단일 소스로 둔다.
export function buildCommunityExtensions(): Extensions {
  return [
    StarterKit,
    TextStyle,
    Color,
    Underline,
    HighlightNoTextInherit.configure({ multicolor: true }),
    FontSize,
    ResizeImage.configure({
      inline: false,
      minWidth: 80,
      maxWidth: 900,
      allowBase64: true,
      HTMLAttributes: {
        class: "rounded",
      },
    }),
    Youtube.configure({
      width: 480,
      height: 270,
      HTMLAttributes: {
        class: "my-4 rounded",
      },
    }),
    EmbedExtension,
  ];
}
