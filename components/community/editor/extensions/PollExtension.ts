import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { PollView, type PollOption } from "./PollView";

// 본문에 넣는 단일선택 투표 블록.
// 정의(질문·선택지)는 이 노드 속성으로 본문 JSON 안에 저장되고,
// 응답만 post_poll_votes 테이블에 pollId/optionId 로 쌓인다.
// 그래서 글을 지우면 투표 정의도 함께 사라지고, 표는 고아로 남았다가 조회되지 않는다.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    poll: {
      insertPoll: () => ReturnType;
    };
  }
}

export const PollExtension = Node.create({
  name: "poll",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      pollId: { default: null },
      question: { default: "" },
      options: { default: [] as PollOption[] },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-poll-id]",
        getAttrs: (element) => {
          if (typeof element === "string") return null;
          const raw = element.getAttribute("data-poll-options");
          let options: PollOption[] = [];
          try {
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) options = parsed;
          } catch {
            options = [];
          }
          return {
            pollId: element.getAttribute("data-poll-id"),
            question: element.getAttribute("data-poll-question") ?? "",
            options,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // 에디터 밖(알림 미리보기 등)에서도 최소한 질문은 읽히도록 텍스트를 남긴다.
    return [
      "div",
      mergeAttributes({
        "data-poll-id": HTMLAttributes.pollId,
        "data-poll-question": HTMLAttributes.question,
        "data-poll-options": JSON.stringify(HTMLAttributes.options ?? []),
        class: "poll-block",
      }),
      HTMLAttributes.question || "투표",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PollView);
  },

  addCommands() {
    return {
      insertPoll:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              pollId: crypto.randomUUID(),
              question: "",
              options: [
                { id: crypto.randomUUID(), label: "" },
                { id: crypto.randomUUID(), label: "" },
              ],
            },
          }),
    };
  },
});
