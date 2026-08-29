"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type FormEventHandler } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

import { submitSetPlayerRatingAction } from "./actions";

export type RatingPlayerOption = {
  value: string;
  name: string;
  position: string;
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  teamPrimaryColor?: string;
  profileImageUrl?: string;
  championImageUrl?: string;
  championName?: string;
  averageRating?: number;
  ratingCount: number;
  myRating?: number;
  isPog: boolean;
};

function playerInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "-";
}

const resizeCommentInput: FormEventHandler<HTMLTextAreaElement> = (event) => {
  const input = event.currentTarget;
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
};

function PlayerChip({
  player,
  selected,
  disabled,
  onSelect,
}: {
  player: RatingPlayerOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative h-[76px] w-full overflow-hidden rounded-xl bg-[var(--ui-card-bg)] text-left transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-90 sm:aspect-[3/4] sm:h-auto sm:rounded-[clamp(0.5rem,8%,1rem)] ${
        selected ? "shadow-md" : "shadow-sm"
      }`}
      style={
        selected && player.teamPrimaryColor
          ? { background: `${player.teamPrimaryColor}1f` }
          : undefined
      }
    >
      <div className="absolute inset-y-0 left-0 w-16 sm:inset-0 sm:w-auto">
        {player.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt="" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-xl font-black text-[var(--ui-muted)]">
            {playerInitial(player.name)}
          </div>
        )}
        {player.championImageUrl ? (
          <span className="absolute bottom-[clamp(0.4rem,5%,0.75rem)] right-[clamp(0.4rem,5%,0.75rem)] z-10 hidden aspect-square w-[20%] overflow-hidden rounded-[clamp(0.2rem,12%,0.45rem)] bg-black/35 ring-2 ring-white/80 shadow-md backdrop-blur-sm sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.championImageUrl}
              alt={player.championName ?? ""}
              className="h-full w-full object-cover"
            />
          </span>
        ) : null}
      </div>
      <span className="absolute inset-x-0 bottom-0 hidden h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent sm:block" />
      <span className="absolute left-1.5 top-1.5 z-10 hidden flex-col items-start gap-1 sm:left-2 sm:top-2 sm:flex">
        <span className="flex items-center gap-0.5 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-normal leading-4 text-white backdrop-blur-sm">
          <Star
            aria-hidden="true"
            className={`h-2.5 w-2.5 ${player.averageRating == null ? "text-white/45" : "fill-amber-400 text-amber-400"}`}
          />
          <span className="tabular-nums">{player.averageRating == null ? "-" : player.averageRating.toFixed(1)}</span>
          <span className="hidden text-white/60 lg:inline">· {player.ratingCount}</span>
        </span>
        {player.myRating != null ? (
          <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-normal leading-4 text-black shadow-sm">
            내 평점 {player.myRating.toFixed(1)}
          </span>
        ) : null}
      </span>
      {player.isPog ? (
        <span className="absolute right-2 top-2 z-10 hidden rounded-md bg-amber-400 px-1.5 py-0.5 text-xs font-normal leading-4 text-black shadow-sm sm:block">
          <span className="hidden lg:inline">SET </span>POG
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 right-[30%] hidden min-w-0 sm:block">
        <span className="block truncate text-[15px] font-bold leading-5 text-white">
          {player.name}
        </span>
        <span className="block text-xs font-normal leading-4 text-white/60">{player.position}</span>
      </span>
      <span className="absolute inset-y-0 left-[4.75rem] right-3 flex items-center justify-between gap-3 sm:hidden">
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <b className="truncate text-[15px] leading-5 text-[var(--ui-ink)]">{player.name}</b>
            <span className="shrink-0 text-xs font-normal text-[var(--ui-muted)]">{player.position}</span>
            {player.isPog ? (
              <span className="shrink-0 rounded bg-amber-400 px-1 py-0.5 text-xs font-normal leading-4 text-black">POG</span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs font-normal text-[var(--ui-muted)]">
            {player.myRating != null ? `내 평점 ${player.myRating.toFixed(1)}` : "눌러서 평가하기"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="flex items-center justify-end gap-1 text-[var(--ui-ink)]">
            <Star className={`h-3.5 w-3.5 ${player.averageRating == null ? "text-[var(--ui-border)]" : "fill-amber-400 text-amber-400"}`} />
            <b className="text-lg tabular-nums">{player.averageRating == null ? "-" : player.averageRating.toFixed(1)}</b>
          </span>
          <span className="block text-xs font-normal text-[var(--ui-muted)]">{player.ratingCount}명 참여</span>
        </span>
      </span>
    </button>
  );
}

/**
 * 별 하나를 좌/우 절반 버튼 두 개로 겹쳐 그린다. 각 버튼은 자기 절반 너비로
 * overflow-hidden해, 전체 별 아이콘의 절반만 보여준다.
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
      className="relative h-5 w-2.5 shrink-0 overflow-hidden disabled:cursor-not-allowed"
    >
      <Star aria-hidden="true" className={`absolute top-0 h-5 w-5 text-[var(--ui-border)] ${sidePosition}`} />
      {filled ? (
        <Star
          aria-hidden="true"
          fill="currentColor"
          className={`absolute top-0 h-5 w-5 text-amber-400 ${sidePosition}`}
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
    <div className="flex h-6 items-center gap-2">
      <div className="flex items-center" role="radiogroup" aria-label="평점 선택">
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
      <span className="inline-flex items-baseline text-[15px] font-bold leading-none tabular-nums text-[var(--ui-ink)]">
        {value == null ? "-" : value.toFixed(1)}
        <span className="ml-1 text-sm font-normal text-[var(--ui-muted)]">/ 5</span>
      </span>
    </div>
  );
}

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
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  // 제출 직후 "내 평점"을 서버 재검증 없이 바로 반영하기 위한 낙관적 값(선수 id → 평점).
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (refreshTick === 0) return;
    // 서버 액션은 revalidate 없이 즉시 반환한다. 평균/코멘트 등 나머지는 배경에서 갱신.
    router.refresh();
  }, [refreshTick, router]);
  // 모바일 시트(.modal-backdrop 포함)는 데스크탑에선 DOM에 넣지 않는다.
  // globals.css 의 `html:has(.modal-backdrop) { overflow: hidden }` 는 :has() 특성상
  // display:none 인 요소도 매칭해, sm:hidden 로만 숨기면 데스크탑에서 스크롤이 잠긴다.
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsSmallScreen(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const effectiveOptions = playerOptions.map((player) =>
    player.value in localRatings ? { ...player, myRating: localRatings[player.value] } : player,
  );
  const selectedPlayer = effectiveOptions.find((player) => player.value === selectedPlayerId);
  const disabled = !ratingOpen || !isLoggedIn || playerOptions.length === 0 || isPending;
  const canSubmit = !disabled && selectedPlayerId !== "" && selectedRating != null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const formData = new FormData(event.currentTarget);

    const submittedPlayerId = selectedPlayerId;
    const submittedRating = selectedRating;

    startTransition(async () => {
      const result = await submitSetPlayerRatingAction(formData);
      if (result.ok) {
        showToast({ title: "평점이 제출되었습니다!", tone: "success" });
        if (submittedRating != null) {
          setLocalRatings((prev) => ({ ...prev, [submittedPlayerId]: submittedRating }));
        }
        formRef.current?.reset();
        setSelectedPlayerId("");
        setSelectedRating(null);
        setReview("");
        setMobileComposerOpen(false);
        setRefreshTick((tick) => tick + 1);
      } else {
        showToast({ title: result.error ?? "평점 제출에 실패했습니다.", tone: "error" });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="relative flex flex-col gap-4">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="setId" value={setId} />
      <input type="hidden" name="playerId" value={selectedPlayerId} />
      <input type="hidden" name="rating" value={selectedRating ?? ""} />
      <input type="hidden" name="review" value={review} />

      {!isLoggedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5">
          <p className="text-sm font-normal text-[var(--ui-muted)]">평점을 남기려면 로그인이 필요합니다.</p>
          <Link
            href={loginHref}
            className="shrink-0 rounded-lg bg-[var(--ui-ink)] px-3 py-1.5 text-[15px] font-bold text-[var(--ui-surface)] transition-opacity hover:opacity-85"
          >
            로그인
          </Link>
        </div>
      ) : null}

      <div className="relative">
        <div className="flex flex-col gap-5 sm:gap-8">
          {[
            effectiveOptions.filter((player) => player.teamId === blueTeamId),
            effectiveOptions.filter((player) => player.teamId !== blueTeamId),
          ].map((teamPlayers, teamIndex) =>
            teamPlayers.length === 0 ? null : (
              <div key={teamIndex} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 px-0.5 py-1">
                  {teamPlayers[0].teamLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={teamPlayers[0].teamLogoUrl} alt="" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
                  ) : null}
                  <h3 className="text-base font-black text-[var(--ui-ink)] sm:text-lg">{teamPlayers[0].teamName}</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {teamPlayers.map((player) => (
                    <PlayerChip
                      key={player.value}
                      player={player}
                      selected={player.value === selectedPlayerId}
                      disabled={disabled}
                      onSelect={() => {
                        setSelectedPlayerId(player.value);
                        setSelectedRating(player.myRating ?? null);
                        setMobileComposerOpen(true);
                      }}
                    />
                  ))}
                </div>
                {selectedPlayer && teamPlayers.some((player) => player.value === selectedPlayer.value) ? (
                  <div className="hidden rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5 sm:block">
                    <div className="flex items-center justify-between gap-4">
                      <p className="truncate text-[15px] font-bold text-[var(--ui-ink)]">
                        {selectedPlayer.name} 평가
                      </p>
                      <StarRatingPicker value={selectedRating} disabled={disabled} onChange={setSelectedRating} />
                    </div>
                    <textarea
                      rows={1}
                      maxLength={240}
                      disabled={disabled}
                      value={review}
                      onChange={(event) => setReview(event.target.value)}
                      onInput={resizeCommentInput}
                      placeholder="평가 코멘트 (선택)"
                      className="mt-2 block w-full resize-none overflow-hidden rounded-lg bg-[var(--ui-surface)] px-3 py-2 text-[15px] leading-6 text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <span className="text-[13px] tabular-nums text-[var(--ui-muted)]">{review.length}/240자</span>
                      <Button type="submit" variant="secondary" disabled={!canSubmit}>
                        {isPending ? "등록 중" : "등록"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      </div>

      {selectedPlayer && mobileComposerOpen && isSmallScreen ? (
        <div className="fixed inset-x-0 top-0 bottom-[var(--shell-bottom-nav-height)] z-50 flex items-end sm:hidden">
          <button
            type="button"
            aria-label="평가 입력 닫기"
            className="modal-backdrop absolute inset-0 bg-black/45 [--modal-backdrop-dark-mobile:0.65]"
            onClick={() => setMobileComposerOpen(false)}
          />
          <div className="relative z-10 w-full overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl">
            <DialogSheetHeader
              closeLabel="평가 입력 닫기"
              onClose={() => setMobileComposerOpen(false)}
              title={`${selectedPlayer.name} 평가`}
            />
            <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
                  {selectedPlayer.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedPlayer.profileImageUrl} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="grid h-full place-items-center font-black text-[var(--ui-muted)]">
                      {playerInitial(selectedPlayer.name)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-[var(--ui-ink)]">{selectedPlayer.name}</p>
                  <p className="text-[13px] font-normal text-[var(--ui-muted)]">{selectedPlayer.teamName} · {selectedPlayer.position}</p>
                </div>
              </div>
              <div className="mt-4">
                <StarRatingPicker value={selectedRating} disabled={disabled} onChange={setSelectedRating} />
              </div>
              <textarea
                rows={2}
                maxLength={240}
                disabled={disabled}
                value={review}
                onChange={(event) => setReview(event.target.value)}
                onInput={resizeCommentInput}
                placeholder="평가 코멘트 (선택)"
                className="mt-4 block w-full resize-none overflow-hidden rounded-xl bg-[var(--ui-surface-muted)] p-3 text-base leading-7 text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="mt-3 flex items-center justify-end gap-3">
                <span className="text-[13px] tabular-nums text-[var(--ui-muted)]">{review.length}/240자</span>
                <Button type="submit" variant="secondary" disabled={!canSubmit}>
                  {isPending ? "등록 중" : "등록"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ratingStatusNote ? (
        <p className="text-sm font-normal text-[var(--ui-muted)]">{ratingStatusNote}</p>
      ) : null}
    </form>
  );
}
