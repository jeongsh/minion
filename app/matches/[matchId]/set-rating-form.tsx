"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { submitSetPlayerRatingAction } from "./actions";

const fieldClassName =
  "min-w-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-sm font-bold text-[var(--ui-ink)] transition-colors placeholder:text-[var(--ui-muted)] hover:border-[var(--ui-ink)] focus:border-[var(--ui-ink)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--ui-border)]";

export function SetRatingForm({
  matchId,
  setId,
  ratingOpen,
  playerOptions,
  ratingOptions,
}: {
  matchId: string;
  setId: string;
  ratingOpen: boolean;
  playerOptions: { value: string; label: string }[];
  ratingOptions: number[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const disabled = !ratingOpen || playerOptions.length === 0 || isPending;

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await submitSetPlayerRatingAction(formData);
      if (result.ok) {
        showToast("평점이 제출되었습니다!", "success");
        formRef.current?.reset();
      } else {
        showToast(result.error ?? "평점 제출에 실패했습니다.", "error");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="relative">
      {toast ? (
        <div className="pointer-events-none absolute -top-3 left-0 right-0 z-10 flex -translate-y-full justify-center">
          <span
            className={`rounded-full px-4 py-1.5 text-[13px] font-bold shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </span>
        </div>
      ) : null}
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="setId" value={setId} />
      <div className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_8rem_minmax(12rem,1.5fr)_auto]">
        <select
          name="playerId"
          required
          disabled={disabled}
          defaultValue=""
          className={fieldClassName}
        >
          <option value="" disabled>
            선수 선택
          </option>
          {playerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select name="rating" required disabled={disabled} defaultValue="" className={fieldClassName}>
          <option value="" disabled>
            점수
          </option>
          {ratingOptions.map((value) => (
            <option key={value} value={value}>
              {value.toFixed(1)}
            </option>
          ))}
        </select>
        <input
          name="review"
          maxLength={240}
          disabled={disabled}
          placeholder="한줄평"
          className={fieldClassName}
        />
        <Button type="submit" disabled={disabled}>
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              제출 중
            </span>
          ) : (
            "제출"
          )}
        </Button>
      </div>
    </form>
  );
}
