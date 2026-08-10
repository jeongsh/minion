"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";

import { submitSetPlayerRatingAction } from "./actions";

export type RatingPlayerOption = {
  value: string;
  name: string;
  position: string;
  teamId: string;
  championImageUrl?: string;
  championName?: string;
};

function playerInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "-";
}

function PlayerChip({
  player,
  selected,
  teamSide,
  disabled,
  onSelect,
}: {
  player: RatingPlayerOption;
  selected: boolean;
  teamSide: "blue" | "red";
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full flex-col items-center gap-1 rounded-xl border p-1.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:p-2.5 ${
        selected
          ? teamSide === "blue"
            ? "border-team-blue bg-team-blue/10"
            : "border-team-red bg-team-red/10"
          : "border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-[var(--ui-ink)]"
      }`}
    >
      <div className="aspect-square w-full max-w-24 overflow-hidden rounded-lg bg-[var(--ui-surface-muted)]">
        {player.championImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.championImageUrl} alt={player.championName ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xl font-black text-[var(--ui-muted)]">
            {playerInitial(player.name)}
          </div>
        )}
      </div>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black text-[var(--ui-ink)] sm:text-[15px]">
          {player.name}
        </span>
        <span className="block text-[10px] font-bold text-[var(--ui-muted)] sm:text-xs">{player.position}</span>
      </span>
    </button>
  );
}

/**
 * 별 하나를 좌/우 절반 버튼 두 개로 겹쳐 그린다. 각 버튼은 자기 절반 너비(w-4)로
 * overflow-hidden해, 전체 너비(w-8)의 별 아이콘을 왼쪽 또는 오른쪽으로 밀어 그 절반만
 * 보이게 한다 — 두 버튼을 나란히 놓으면 다시 별 하나(w-8)로 합쳐진다.
 */
function HalfStar({
  value,
  filled,
  disabled,
  side,
  onSelect,
}: {
  value: number;
  filled: boolean;
  disabled: boolean;
  side: "left" | "right";
  onSelect: (value: number) => void;
}) {
  const sidePosition = side === "left" ? "left-0" : "right-0";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      aria-label={`${value.toFixed(1)}점`}
      className="relative h-7 w-3.5 shrink-0 overflow-hidden disabled:cursor-not-allowed"
    >
      <Star aria-hidden="true" className={`absolute top-0 h-7 w-7 text-[var(--ui-border)] ${sidePosition}`} />
      {filled ? (
        <Star
          aria-hidden="true"
          fill="currentColor"
          className={`absolute top-0 h-7 w-7 text-amber-400 ${sidePosition}`}
        />
      ) : null}
    </button>
  );
}

function StarRatingPicker({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex" role="radiogroup" aria-label="평점 선택">
        {[1, 2, 3, 4, 5].map((star) => {
          const leftValue = star - 0.5;
          const rightValue = star;
          const current = value ?? 0;
          const leftFilled = current >= leftValue;
          const rightFilled = current >= rightValue;
          return (
            <span key={star} className="flex">
              <HalfStar value={leftValue} filled={leftFilled} disabled={disabled} side="left" onSelect={onChange} />
              <HalfStar value={rightValue} filled={rightFilled} disabled={disabled} side="right" onSelect={onChange} />
            </span>
          );
        })}
      </div>
      <span className="text-base font-black tabular-nums text-[var(--ui-ink)]">
        {value == null ? "-" : value.toFixed(1)}
        <span className="ml-0.5 text-xs font-bold text-[var(--ui-muted)]">/ 5</span>
      </span>
    </div>
  );
}

const fieldClassName =
  "min-w-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-3 text-base font-bold text-[var(--ui-ink)] transition-colors placeholder:text-[var(--ui-muted)] hover:border-[var(--ui-ink)] focus:border-[var(--ui-ink)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--ui-border)]";

export function SetRatingForm({
  matchId,
  setId,
  blueTeamId,
  ratingOpen,
  isLoggedIn,
  loginHref,
  ratingStatusNote,
  playerOptions,
}: {
  matchId: string;
  setId: string;
  blueTeamId: string;
  ratingOpen: boolean;
  isLoggedIn: boolean;
  loginHref: string;
  ratingStatusNote?: string;
  playerOptions: RatingPlayerOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const disabled = !ratingOpen || !isLoggedIn || playerOptions.length === 0 || isPending;
  const canSubmit = !disabled && selectedPlayerId !== "" && selectedRating != null;

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await submitSetPlayerRatingAction(formData);
      if (result.ok) {
        showToast("평점이 제출되었습니다!", "success");
        formRef.current?.reset();
        setSelectedPlayerId("");
        setSelectedRating(null);
      } else {
        showToast(result.error ?? "평점 제출에 실패했습니다.", "error");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="relative flex flex-col gap-4">
      {toast ? (
        <div className="pointer-events-none absolute -top-3 left-0 right-0 z-10 flex -translate-y-full justify-center">
          <span
            className={`rounded-full px-4 py-1.5 text-[15px] font-bold shadow-lg ${
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
      <input type="hidden" name="playerId" value={selectedPlayerId} />
      <input type="hidden" name="rating" value={selectedRating ?? ""} />

      {!isLoggedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5">
          <p className="text-sm font-semibold text-[var(--ui-muted)]">평점을 남기려면 로그인이 필요합니다.</p>
          <Link
            href={loginHref}
            className="shrink-0 rounded-lg bg-[var(--ui-ink)] px-3 py-1.5 text-sm font-bold text-[var(--ui-surface)] transition-opacity hover:opacity-85"
          >
            로그인
          </Link>
        </div>
      ) : null}

      <div className="relative">
        {!ratingOpen && ratingStatusNote ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <p className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-center text-sm font-bold text-[var(--ui-ink)] shadow-lg">
              {ratingStatusNote}
            </p>
          </div>
        ) : null}

        <div className={`flex flex-col gap-2 ${!ratingOpen ? "pointer-events-none blur-sm select-none" : ""}`}>
          {[
            playerOptions.filter((player) => player.teamId === blueTeamId),
            playerOptions.filter((player) => player.teamId !== blueTeamId),
          ].map((teamPlayers, teamIndex) =>
            teamPlayers.length === 0 ? null : (
              <div key={teamIndex} className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {teamPlayers.map((player) => (
                  <PlayerChip
                    key={player.value}
                    player={player}
                    selected={player.value === selectedPlayerId}
                    teamSide={teamIndex === 0 ? "blue" : "red"}
                    disabled={disabled}
                    onSelect={() => setSelectedPlayerId(player.value)}
                  />
                ))}
              </div>
            ),
          )}

          <div className="flex items-center gap-3">
            <StarRatingPicker value={selectedRating} disabled={disabled} onChange={setSelectedRating} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="review"
              maxLength={240}
              disabled={disabled}
              placeholder="한줄평"
              className={`${fieldClassName} flex-1`}
            />
            <Button type="submit" size="lg" disabled={!canSubmit}>
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
        </div>
      </div>

      {ratingOpen && ratingStatusNote ? (
        <p className="text-sm font-semibold text-[var(--ui-muted)]">{ratingStatusNote}</p>
      ) : null}
    </form>
  );
}
