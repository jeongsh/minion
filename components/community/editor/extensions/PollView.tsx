"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

export type PollOption = { id: string; label: string };

type Tally = { counts: Record<string, number>; total: number; myOptionId: string | null; signedIn: boolean };

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
    <div className="my-4 flex flex-col gap-2.5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ui-muted)]">투표</span>
        <button
          type="button"
          onClick={deleteNode}
          className="grid h-6 w-6 place-items-center rounded-full text-[var(--ui-muted)] transition hover:text-[var(--ui-ink)]"
          aria-label="투표 삭제"
        >
          <X size={14} />
        </button>
      </div>

      <input
        value={question}
        onChange={(event) => updateAttributes({ question: event.target.value })}
        placeholder="무엇을 물어볼까요? (예: 짜장 vs 짬뽕)"
        className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-[14px] font-bold text-[var(--ui-ink)] outline-none focus:border-[var(--ui-muted)]"
      />

      <div className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-1.5">
            <input
              value={option.label}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, label: event.target.value.slice(0, OPTION_MAX_LENGTH) };
                setOptions(next);
              }}
              placeholder={`선택지 ${index + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-[13px] font-medium text-[var(--ui-ink)] outline-none focus:border-[var(--ui-muted)]"
            />
            {options.length > MIN_OPTIONS ? (
              <button
                type="button"
                onClick={() => setOptions(options.filter((item) => item.id !== option.id))}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--ui-muted)] transition hover:text-[var(--ui-ink)]"
                aria-label={`선택지 ${index + 1} 삭제`}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {options.length < MAX_OPTIONS ? (
        <button
          type="button"
          onClick={() => setOptions([...options, { id: newOptionId(), label: "" }])}
          className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--ui-border)] py-2 text-[12px] font-medium text-[var(--ui-muted)] transition hover:text-[var(--ui-ink)]"
        >
          <Plus size={13} /> 선택지 추가
        </button>
      ) : null}

      <p className="text-[11px] font-medium text-[var(--ui-muted)]">
        올린 뒤에는 선택지 문구만 고칠 수 있어요. 선택지를 지우면 그 표도 사라집니다.
      </p>
    </div>
  );
}

/** 읽기 모드: 실제 투표. 투표 전에는 득표를 감추고, 투표하면 막대와 비율을 보여준다. */
function PollVoter({ node }: NodeViewProps) {
  const pollId = node.attrs.pollId as string;
  const options = (node.attrs.options ?? []) as PollOption[];
  const question = (node.attrs.question ?? "") as string;

  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 언마운트 후 setState 하지 않도록 플래그로 끊는다.
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}`, { cache: "no-store" });
        if (!cancelled && response.ok) setTally(await response.json());
      } catch {
        // 집계 실패는 투표 UI를 막지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pollId]);

  async function vote(optionId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/polls/${pollId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "투표에 실패했어요.");
        return;
      }
      setTally(payload);
    } finally {
      setBusy(false);
    }
  }

  const voted = Boolean(tally?.myOptionId);
  const total = tally?.total ?? 0;

  return (
    <div className="my-4 flex flex-col gap-2.5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3.5">
      {question ? <p className="text-[15px] font-black text-[var(--ui-ink)]">{question}</p> : null}

      <div className="flex flex-col gap-1.5">
        {options.map((option) => {
          const count = tally?.counts[option.id] ?? 0;
          const percent = voted && total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = tally?.myOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              disabled={busy}
              className={`relative flex min-h-11 items-center justify-between gap-3 overflow-hidden rounded-xl border px-3.5 text-left transition disabled:opacity-60 ${
                mine
                  ? "border-[var(--team-primary,var(--ui-ink))] bg-[var(--ui-surface)]"
                  : "border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-[var(--ui-muted)]"
              }`}
            >
              {voted ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-[var(--team-primary,var(--ui-ink))] opacity-[0.14] transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              ) : null}
              <span className="relative min-w-0 truncate text-[13px] font-bold text-[var(--ui-ink)]">
                {option.label || "(빈 선택지)"}
              </span>
              {voted ? (
                <span className="relative shrink-0 text-[12px] font-medium text-[var(--ui-text)]">
                  {percent}% · {count}표
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] font-medium text-[var(--ui-muted)]">
        {busy ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> 처리 중…
          </span>
        ) : voted ? (
          `${total}명 참여 · 다시 누르면 취소돼요`
        ) : tally?.signedIn === false ? (
          "로그인하면 투표할 수 있어요"
        ) : (
          `${total}명 참여 · 투표하면 결과가 보여요`
        )}
      </p>

      {error ? <p className="text-[12px] font-medium text-red-500">{error}</p> : null}
    </div>
  );
}

export function PollView(props: NodeViewProps) {
  return (
    <NodeViewWrapper>
      {props.editor.isEditable ? <PollEditor {...props} /> : <PollVoter {...props} />}
    </NodeViewWrapper>
  );
}
