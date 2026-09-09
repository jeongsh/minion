"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Plus, X } from "lucide-react";
import { PollVoter, type PollOption } from "@/components/community/poll-voter";

export type { PollOption } from "@/components/community/poll-voter";

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;
const OPTION_MAX_LENGTH = 40;
function newOptionId() {
  return crypto.randomUUID();
}

/** 편집 모드: 선택지 문구를 직접 고친다. 투표 결과는 보여주지 않는다. */
function PollEditor({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const options = (node.attrs.options ?? []) as PollOption[];
  const question = (node.attrs.question ?? "") as string;

  function setOptions(next: PollOption[]) {
    updateAttributes({ options: next });
  }

  return (
    <div className="my-4 flex flex-col gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold leading-6 text-[var(--ui-ink)]">투표 만들기</p>
          <p className="text-[13px] font-medium leading-5 text-[var(--ui-muted)]">질문과 선택지를 입력해 주세요.</p>
        </div>
        <button
          type="button"
          onClick={deleteNode}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--ui-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
          aria-label="투표 삭제"
        >
          <X size={18} />
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[var(--ui-text)]">질문</span>
        <input
          value={question}
          onChange={(event) => updateAttributes({ question: event.target.value })}
          placeholder="무엇을 물어볼까요?"
          className="min-h-11 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[14px] font-medium text-[var(--ui-ink)] outline-none transition-colors placeholder:text-[var(--ui-muted)] focus:border-[var(--accent)]"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-[var(--ui-text)]">선택지</span>
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <input
              value={option.label}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, label: event.target.value.slice(0, OPTION_MAX_LENGTH) };
                setOptions(next);
              }}
              placeholder={`선택지 ${index + 1}`}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[14px] font-medium text-[var(--ui-ink)] outline-none transition-colors placeholder:text-[var(--ui-muted)] focus:border-[var(--accent)]"
            />
            {options.length > MIN_OPTIONS ? (
              <button
                type="button"
                onClick={() => setOptions(options.filter((item) => item.id !== option.id))}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
                aria-label={`선택지 ${index + 1} 삭제`}
              >
                <X size={17} />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {options.length < MAX_OPTIONS ? (
        <button
          type="button"
          onClick={() => setOptions([...options, { id: newOptionId(), label: "" }])}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[14px] font-medium text-[var(--ui-text)] transition-colors hover:border-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]"
        >
          <Plus size={17} /> 선택지 추가
        </button>
      ) : null}

      <p className="text-right text-[13px] font-medium text-[var(--ui-muted)]">최대 {MAX_OPTIONS}개까지 추가할 수 있어요.</p>
    </div>
  );
}

export function PollView(props: NodeViewProps) {
  return (
    <NodeViewWrapper>
      {props.editor.isEditable ? <PollEditor {...props} /> : <PollVoter pollId={props.node.attrs.pollId ?? ""} question={props.node.attrs.question ?? ""} options={props.node.attrs.options ?? []} />}
    </NodeViewWrapper>
  );
}
