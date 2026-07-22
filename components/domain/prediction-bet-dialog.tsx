"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { TicketCheck, X } from "lucide-react";

import { cancelPredictionBetAction, placePredictionBetAction } from "@/app/predictions/actions";
import flag from "@/assets/characters/flag-2.png";
import { useToast } from "@/components/ui/toast";
import type { PredictionBet } from "@/lib/predictions";
import { predictionMaxStake } from "@/lib/predictions";

type DialogState = { matchId: string; teamId: string; teamName: string; existingBet?: PredictionBet };

export function usePredictionBetDialog({ currentUserId, balance, bets }: { currentUserId?: string; balance: number | null; bets: PredictionBet[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [stake, setStake] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(matchId: string, teamId: string, teamName: string) {
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setStake("1000");
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 px-4 py-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="prediction-ticket adaptive-dialog-panel max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto overflow-x-hidden dark:bg-[var(--ui-surface-muted)] sm:w-full" role="dialog" aria-modal="true" aria-labelledby="quick-bet-title">
        <span className="prediction-ticket__stub" aria-hidden />
        <div className="prediction-ticket__content">
          <div className="prediction-ticket__head">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3 pl-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--palette-green-butter-point)] text-[var(--palette-green-butter-main)]"><TicketCheck size={24} strokeWidth={2.4} /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[var(--ui-muted)]">LP PREDICTION</p>
                  <h2 id="quick-bet-title" className="mt-1 truncate text-xl font-black text-[var(--ui-ink)]">{dialog.teamName} 승리 예측</h2>
                </div>
              </div>
              <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" aria-label="닫기"><X size={18} /></button>
            </div>
          </div>

          <div className="prediction-ticket__body">
            {dialog.existingBet ? (
              <div className="rounded-xl bg-[var(--ui-surface-muted)] p-4">
                <p className="text-sm font-bold text-[var(--ui-ink)]">이미 이 경기에 {dialog.existingBet.stake.toLocaleString("ko-KR")} LP를 사용했습니다.</p>
                <p className="mt-1 text-[13px] text-[var(--ui-muted)]">팀이나 금액을 바꾸려면 기존 예측을 취소한 뒤 다시 참여해 주세요.</p>
                <button type="button" onClick={onCancel} disabled={pending} className="mt-4 h-10 w-full rounded-lg bg-[var(--palette-tomato-butter-main)] text-sm font-black text-white transition hover:bg-[var(--palette-tomato-butter-hover)] disabled:opacity-50">예측 취소하고 LP 환불</button>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <label htmlFor="quick-prediction-stake" className="text-sm font-bold text-[var(--ui-ink)]">사용할 LP</label>
                  <span className="text-[13px] font-semibold text-[var(--ui-muted)]">1회 한도 {maxStake.toLocaleString("ko-KR")} LP</span>
                </div>
                <div className="mt-2 flex h-14 items-center rounded-xl border border-[var(--ui-border)] px-4 focus-within:border-[var(--ui-ink)]">
                  <input id="quick-prediction-stake" type="number" min={100} max={maxStake} step={100} value={stake} onChange={(event) => onStakeChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-2xl font-black tabular-nums text-[var(--ui-ink)] outline-none" />
                  <span className="text-sm font-black text-[var(--ui-muted)]">LP</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[0.25, 0.5, 0.75, 1].map((ratio) => (
                    <button key={ratio} type="button" onClick={() => onStakeChange(String(Math.max(100, Math.floor((maxStake * ratio) / 100) * 100)))} className="h-9 rounded-lg bg-[var(--ui-surface-muted)] text-[13px] font-bold text-[var(--ui-text)] hover:opacity-80">{ratio === 1 ? "최대" : `${ratio * 100}%`}</button>
                  ))}
                </div>
                <p className={`mt-3 text-[13px] font-semibold ${valid ? "text-[var(--ui-muted)]" : "text-red-500"}`}>{valid ? `보유 ${balance.toLocaleString("ko-KR")} LP · 경기당 최대 20%, 상한 5,000 LP` : `100 LP 이상 ${maxStake.toLocaleString("ko-KR")} LP 이하로 입력해 주세요.`}</p>
                <button type="button" onClick={onSubmit} disabled={!valid || pending} className="mt-5 h-12 w-full rounded-xl bg-[var(--ui-ink)] text-sm font-black text-[var(--ui-surface)] transition hover:opacity-90 disabled:opacity-40">{pending ? "처리 중..." : `${amount.toLocaleString("ko-KR")} LP로 확정`}</button>
              </>
            )}
            {error ? <p className="mt-3 text-center text-[13px] font-bold text-red-500">{error}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
