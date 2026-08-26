"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

export type PollOption = { id: string; label: string };

type Tally = { counts: Record<string, number>; total: number; myOptionId: string | null; signedIn: boolean };

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;
const OPTION_MAX_LENGTH = 40;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newOptionId() {
  return crypto.randomUUID();
}

function pollStorageId(value: string, namespace: "option" | "poll") {
  if (UUID_PATTERN.test(value)) return value.toLowerCase();
  const input = `${namespace}:${value}`;
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  let hex = seeds.map((seed) => {
    let hash = seed;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("");
  hex = `${hex.slice(0, 12)}5${hex.slice(13, 16)}a${hex.slice(17)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

/** 읽기 모드: 실제 투표. 투표 전에는 득표를 감추고, 투표하면 막대와 비율을 보여준다. */
function PollVoter({ node }: NodeViewProps) {
  const pollId = node.attrs.pollId as string;
  const options = (node.attrs.options ?? []) as PollOption[];
  const question = (node.attrs.question ?? "") as string;
  const storagePollId = pollStorageId(pollId, "poll");

  const [tally, setTally] = useState<Tally | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 언마운트 후 setState 하지 않도록 플래그로 끊는다.
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/polls/${storagePollId}`, { cache: "no-store" });
        if (!cancelled && response.ok) setTally(await response.json());
      } catch {
        // 집계 실패는 투표 UI를 막지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePollId]);

  async function vote(optionId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/polls/${storagePollId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: pollStorageId(optionId, "option") }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "투표에 실패했어요.");
        return;
      }
      setTally(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "투표를 처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const voted = Boolean(tally?.myOptionId);
  const total = tally?.total ?? 0;

  return (
    <div className="my-4 flex flex-col gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 md:p-4">
      {question ? <p className="text-[16px] font-bold leading-6 text-[var(--ui-ink)]">{question}</p> : null}

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const storageOptionId = pollStorageId(option.id, "option");
          const count = tally?.counts[storageOptionId] ?? 0;
          const percent = voted && total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = tally?.myOptionId === storageOptionId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              disabled={busy}
              className={`relative flex min-h-12 items-center justify-between gap-3 overflow-hidden rounded-lg border px-3 text-left transition-colors disabled:opacity-60 ${
                mine
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--ui-surface))]"
                  : "border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]"
              }`}
            >
              {voted ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-[var(--accent)] opacity-[0.12] transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              ) : null}
              <span className="relative flex min-w-0 items-center text-[14px] font-medium text-[var(--ui-ink)]">
                <span className="truncate">{option.label || "(빈 선택지)"}</span>
              </span>
              {voted ? (
                <span className="relative inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-[var(--ui-text)]">
                  {mine ? <Check size={15} strokeWidth={2.5} className="text-[var(--accent)]" /> : null}
                  <span>{percent}%</span>
                  <span className="text-[var(--ui-muted)]">{count}표</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] font-medium text-[var(--ui-muted)]">
        {busy ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 size={14} className="animate-spin" /> 처리 중…
          </span>
        ) : (
          <>
            <span>총 {total}명 참여</span>
            <span>{voted ? "선택을 다시 누르면 취소할 수 있어요." : "선택하면 결과를 확인할 수 있어요."}</span>
          </>
        )}
      </div>

      {error ? <p className="text-[13px] font-medium text-red-500">{error}</p> : null}
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
