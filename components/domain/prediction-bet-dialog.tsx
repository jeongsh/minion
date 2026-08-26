"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { cancelPredictionBetAction, placePredictionBetAction } from "@/app/predictions/actions";
import flag from "@/assets/characters/flag-2.png";
import { DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { useToast } from "@/components/ui/toast";
import type { PredictionBet } from "@/lib/predictions";
import { predictionMaxStake } from "@/lib/predictions";

type DialogState = { matchId: string; teamId: string; teamName: string; existingBet?: PredictionBet };

export function usePredictionBetDialog({ currentUserId, balance, bets }: { currentUserId?: string; balance: number | null; bets: PredictionBet[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [stake, setStake] = useState(() => String(Math.min(1000, predictionMaxStake(balance ?? 0))));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(matchId: string, teamId: string, teamName: string) {
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setStake(String(Math.min(1000, predictionMaxStake(balance ?? 0))));
    setError(null);
    setDialog({ matchId, teamId, teamName, existingBet: bets.find((bet) => bet.userId === currentUserId && bet.matchId === matchId && bet.status === "open") });
  }

  function submit() {
    if (!dialog) return;
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("matchId", dialog.matchId);
        data.set("teamId", dialog.teamId);
        data.set("stake", stake);
        await placePredictionBetAction(data);
        setDialog(null);
        showToast({
          title: `${dialog.teamName} 승리 예측 확정`,
          description: "티켓 발권 완료. LP는 경기 결과에 따라 정산돼요.",
          tone: "success",
          iconSrc: flag.src,
        });
        router.refresh();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "예측을 등록하지 못했습니다.";
        setError(message);
        showToast({ title: "예측 실패", description: message, tone: "error" });
      }
    });
  }

  function cancel() {
    if (!dialog?.existingBet) return;
    const existingBet = dialog.existingBet;
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("matchId", dialog.matchId);
        await cancelPredictionBetAction(data);
        setDialog(null);
        showToast({
          title: "예측 취소 완료",
          description: `${existingBet.stake.toLocaleString("ko-KR")} LP가 반환됐어요.`,
          tone: "success",
          iconSrc: flag.src,
        });
        router.refresh();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "예측을 취소하지 못했습니다.";
        setError(message);
        showToast({ title: "취소 실패", description: message, tone: "error" });
      }
    });
  }

  return {
    open,
    pending,
    modal: typeof document !== "undefined" && dialog
      ? createPortal(
          <PredictionBetDialog dialog={dialog} balance={balance ?? 0} stake={stake} pending={pending} error={error} onStakeChange={setStake} onClose={() => setDialog(null)} onSubmit={submit} onCancel={cancel} />,
          document.body,
        )
      : null,
  };
}

function PredictionBetDialog({ dialog, balance, stake, pending, error, onStakeChange, onClose, onSubmit, onCancel }: { dialog: DialogState; balance: number; stake: string; pending: boolean; error: string | null; onStakeChange: (value: string) => void; onClose: () => void; onSubmit: () => void; onCancel: () => void }) {
  const amount = Number(stake);
  const maxStake = predictionMaxStake(balance);
  const valid = Number.isSafeInteger(amount) && amount >= 100 && amount <= maxStake;

  return (
    <div className="modal-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="adaptive-dialog-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl sm:max-w-md sm:rounded-[24px] dark:bg-[var(--ui-surface-muted)]" role="dialog" aria-modal="true" aria-labelledby="quick-bet-title">
        <DialogSheetHeader onClose={onClose} title="승부예측" titleId="quick-bet-title" />

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {dialog.existingBet ? (
              <div className="rounded-xl bg-[var(--ui-card-bg)] p-4">
                <p className="text-[13px] font-bold text-[var(--ui-ink)]">이미 이 경기에 {dialog.existingBet.stake.toLocaleString("ko-KR")} LP를 사용했습니다.</p>
                <p className="mt-1 text-[12px] leading-[18px] text-[var(--ui-muted)]">팀이나 금액을 바꾸려면 기존 예측을 취소한 뒤 다시 참여해 주세요.</p>
                <button type="button" onClick={onCancel} disabled={pending} className="mt-4 h-10 w-full rounded-lg bg-[var(--palette-tomato-butter-main)] text-[13px] font-black text-white transition hover:bg-[var(--palette-tomato-butter-hover)] disabled:opacity-50">예측 취소하고 LP 환불</button>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <label htmlFor="quick-prediction-stake" className="text-[13px] font-bold text-[var(--ui-ink)]">사용할 LP</label>
                  <span className="text-[12px] font-medium text-[var(--ui-muted)]">1회 한도 {maxStake.toLocaleString("ko-KR")} LP</span>
                </div>
                <div className="mt-2 flex h-14 items-center rounded-xl border border-[var(--ui-border)] px-4 focus-within:border-[var(--ui-ink)]">
                  <input id="quick-prediction-stake" type="number" min={100} max={maxStake} step={100} value={stake} onChange={(event) => onStakeChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg font-black tabular-nums text-[var(--ui-ink)] outline-none" />
                  <span className="text-[13px] font-black text-[var(--ui-muted)]">LP</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[0.25, 0.5, 0.75, 1].map((ratio) => (
                    <button key={ratio} type="button" onClick={() => onStakeChange(String(Math.max(100, Math.floor((maxStake * ratio) / 100) * 100)))} className="h-9 rounded-lg bg-[var(--ui-card-bg)] text-[12px] font-medium text-[var(--ui-text)] hover:opacity-80">{ratio === 1 ? "최대" : `${ratio * 100}%`}</button>
                  ))}
                </div>
                <p className={`mt-3 text-[12px] font-medium leading-[18px] ${valid ? "text-[var(--ui-muted)]" : "text-red-500"}`}>{valid ? `보유 ${balance.toLocaleString("ko-KR")} LP · 경기당 최대 20%, 상한 5,000 LP` : `100 LP 이상 ${maxStake.toLocaleString("ko-KR")} LP 이하로 입력해 주세요.`}</p>
                <button type="button" onClick={onSubmit} disabled={!valid || pending} className="mt-5 h-12 w-full rounded-xl bg-[var(--ui-ink)] text-[13px] font-black text-[var(--ui-surface)] transition hover:opacity-90 disabled:opacity-40">{pending ? "처리 중..." : `${amount.toLocaleString("ko-KR")} LP로 확정`}</button>
              </>
            )}
            {error ? <p className="mt-3 text-center text-[12px] font-medium text-red-500">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
