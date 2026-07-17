"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clock3, Coins, RotateCcw, Trophy, X } from "lucide-react";

import { cancelPredictionBetAction, placePredictionBetAction } from "@/app/predictions/actions";
import { ScheduleTodayScroll } from "@/components/domain/schedule-today-scroll";
import { AdSlot } from "@/components/ui/ad-slot";
import { TeamLogo } from "@/components/ui/team-logo";
import { predictionMarketForMatch, predictionMaxStake, type PredictionBet, type PredictionRanking } from "@/lib/predictions";
import { dateKeyKST } from "@/lib/view-data";
import type { Match, Team, Tournament } from "@/lib/types";

const PREDICTION_DAY_SECTION_PREFIX = "prediction-day";

type PredictionBoardProps = {
  matches: Match[];
  teams: Team[];
  tournaments: Tournament[];
  bets: PredictionBet[];
  currentUserId?: string;
  balance: number | null;
  now: number;
  leaderboard: PredictionRanking[];
};

type BetDialog = { matchId: string; teamId: string; teamName: string; existingBet?: PredictionBet };

const KST_OFFSET = 9 * 60 * 60 * 1000;

function weekStartKey(date: string) {
  const value = new Date(new Date(date).getTime() + KST_OFFSET);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(new Date(date));
}

function timeLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date));
}

function deadlineLabel(date: string, closed: boolean, now: number) {
  if (closed) return "예측 마감";
  const minutes = Math.max(0, Math.floor((new Date(date).getTime() - now) / 60000));
  if (minutes < 60) return `${minutes}분 남음`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 남음`;
  return `${Math.floor(minutes / 1440)}일 남음`;
}

function teamColor(team: Team | undefined) {
  const color = team?.primaryColor;
  return color && /^#[\da-f]{6}$/i.test(color) ? color : "#3b3f46";
}

export function PredictionBoard({ matches, teams, tournaments, bets, currentUserId, balance, now, leaderboard }: PredictionBoardProps) {
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(() => weekStartKey(new Date().toISOString()));
  const [selectedTournament, setSelectedTournament] = useState("all");
  const [dialog, setDialog] = useState<BetDialog | null>(null);
  const [stake, setStake] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const tournamentMap = useMemo(() => new Map(tournaments.map((item) => [item.id, item])), [tournaments]);
  const weekKeys = useMemo(() => Array.from(new Set(matches.map((match) => weekStartKey(match.matchDate)))).sort(), [matches]);
  const weekIndex = Math.max(0, weekKeys.indexOf(selectedWeek));
  const weekMatches = matches.filter((match) => weekStartKey(match.matchDate) === selectedWeek);
  const tournamentIds = Array.from(new Set(weekMatches.map((match) => match.tournamentId)));
  const filteredMatches = weekMatches
    .filter((match) => selectedTournament === "all" || match.tournamentId === selectedTournament)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const grouped = Object.groupBy(filteredMatches, (match) => dateKeyKST(match.matchDate));
  const groupedEntries = Object.entries(grouped);
  const todayKey = dateKeyKST(new Date(now).toISOString());
  // 오늘 → 없으면 오늘 이후 가장 가까운 날 → 그마저 없으면 마지막(가장 최근) 날로 스크롤한다.
  const scrollTargetDateKey =
    groupedEntries.find(([date]) => date >= todayKey)?.[0] ?? groupedEntries[groupedEntries.length - 1]?.[0];

  function moveWeek(direction: number) {
    const next = weekKeys[weekIndex + direction];
    if (!next) return;
    setSelectedWeek(next);
    setSelectedTournament("all");
  }

  function openBetDialog(match: Match, team: Team | undefined) {
    if (!currentUserId) {
      router.push("/login?next=/predictions");
      return;
    }
    if (!team) return;
    const existingBet = bets.find((bet) => bet.userId === currentUserId && bet.matchId === match.id && bet.status === "open");
    setStake("1000");
    setDialog({ matchId: match.id, teamId: team.id, teamName: team.shortName, existingBet });
  }

  function submitBet() {
    if (!dialog) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("matchId", dialog.matchId);
        formData.set("teamId", dialog.teamId);
        formData.set("stake", stake);
        await placePredictionBetAction(formData);
        setError(null);
        setDialog(null);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "예측을 저장하지 못했습니다.");
      }
    });
  }

  function cancelBet() {
    if (!dialog?.existingBet) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("matchId", dialog.matchId);
        await cancelPredictionBetAction(formData);
        setError(null);
        setDialog(null);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "예측을 취소하지 못했습니다.");
      }
    });
  }

  return (
    <div className="mt-6 xl:mt-8">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
      <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-4 dark:bg-[var(--ui-surface-muted)] sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center justify-start gap-1 sm:w-auto">
            <button type="button" onClick={() => moveWeek(-1)} disabled={weekIndex <= 0} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)] disabled:opacity-30" aria-label="이전 주"><ChevronLeft size={18} /></button>
            <p className="min-w-[118px] text-center text-[15px] font-black text-[var(--ui-ink)]">{selectedWeek.replaceAll("-", ".")}</p>
            <button type="button" onClick={() => moveWeek(1)} disabled={weekIndex >= weekKeys.length - 1} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)] disabled:opacity-30" aria-label="다음 주"><ChevronRight size={18} /></button>
          </div>
          <div className="hidden h-6 w-px bg-[var(--ui-border)] sm:block" />
          <div className="hidden w-full min-w-0 gap-2 overflow-x-auto sm:flex sm:flex-1">
            <FilterButton active={selectedTournament === "all"} onClick={() => setSelectedTournament("all")}>전체</FilterButton>
            {tournamentIds.map((id) => <FilterButton key={id} active={selectedTournament === id} onClick={() => setSelectedTournament(id)}>{tournamentMap.get(id)?.name ?? "대회"}</FilterButton>)}
          </div>
          <div className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ui-surface-muted)] px-2.5 text-[13px] font-black tabular-nums text-[var(--ui-ink)] sm:bg-transparent sm:px-0 sm:text-sm">
            <Coins size={16} />
            {balance === null ? "로그인" : `${balance.toLocaleString("ko-KR")} LP`}
          </div>
        </div>
      </section>

      <PredictionAdSlot className="mt-4 xl:hidden" />

      {error ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="오류 닫기"><RotateCcw size={16} /></button></div> : null}

      <div className="mt-9 flex flex-col gap-10">
        {scrollTargetDateKey ? (
          <ScheduleTodayScroll targetId={`${PREDICTION_DAY_SECTION_PREFIX}-${scrollTargetDateKey}`} />
        ) : null}
        {groupedEntries.map(([date, dayMatches]) => dayMatches ? (
          <section key={date} id={`${PREDICTION_DAY_SECTION_PREFIX}-${date}`} className="scroll-mt-20">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-[var(--ui-ink)]">
              {dateLabel(dayMatches[0].matchDate)}
              {date === todayKey ? <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[13px] font-medium text-[var(--accent-foreground)]">오늘</span> : null}
            </h2>
            <div className="flex flex-col gap-5">
              {dayMatches.map((match) => {
                const teamA = teamMap.get(match.teamAId);
                const teamB = teamMap.get(match.teamBId);
                const matchBets = bets.filter((item) => item.matchId === match.id && item.status === "open");
                const myBet = currentUserId ? matchBets.find((item) => item.userId === currentUserId) : undefined;
                const myVote = myBet?.teamId;
                const market = predictionMarketForMatch(matchBets, match.id, match.teamAId, match.teamBId);
                const aPercent = market.teamAPercent;
                const closed = new Date(match.matchDate).getTime() <= now || match.status !== "scheduled";

                return (
                  <article key={match.id}>
                    <div className="mb-2 flex items-center justify-between gap-3 px-1 text-sm font-bold">
                      <div className="flex min-w-0 items-center gap-2">
                        <time className="shrink-0 text-[var(--ui-ink)]">{timeLabel(match.matchDate)}</time>
                        <span className="hidden truncate text-[var(--ui-muted)] sm:inline">{tournamentMap.get(match.tournamentId)?.name ?? "LEAGUE"}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-[13px] text-[var(--ui-muted)]">
                        {myBet ? <span className="font-black text-[var(--ui-ink)]">내 예측 {myBet.stake.toLocaleString("ko-KR")} LP</span> : null}
                        <span className="flex items-center gap-1.5"><Clock3 size={13} />{deadlineLabel(match.matchDate, closed, now)}</span>
                      </div>
                    </div>
                    <div
                      className={`prediction-match-card grid min-h-[76px] grid-cols-[minmax(0,1fr)_34px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] dark:bg-[var(--ui-surface-muted)] sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] xl:h-[76px] ${myVote === match.teamAId ? "prediction-match-card--selected-left" : myVote === match.teamBId ? "prediction-match-card--selected-right" : ""}`}
                      style={myVote ? { "--prediction-team-color": teamColor(myVote === match.teamAId ? teamA : teamB) } as React.CSSProperties : undefined}
                    >
                      <TeamChoice team={teamA} percent={aPercent} odds={market.teamAOdds} selected={myVote === match.teamAId} disabled={closed || isPending} onClick={() => openBetDialog(match, teamA)} />
                      <div className="grid place-items-center text-[13px] font-black text-[var(--ui-muted)] sm:text-sm">VS</div>
                      <TeamChoice team={teamB} percent={market.teamBPercent} odds={market.teamBOdds} selected={myVote === match.teamBId} disabled={closed || isPending} onClick={() => openBetDialog(match, teamB)} right />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null)}

        {!filteredMatches.length ? <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] py-16 text-center dark:bg-[var(--ui-surface-muted)]"><Trophy className="mx-auto text-[var(--ui-muted)]" size={28} /><p className="mt-3 text-[15px] font-bold text-[var(--ui-ink)]">예측 가능한 경기가 없습니다</p><p className="mt-1 text-sm text-[var(--ui-muted)]">다른 주차나 대회를 선택해 주세요.</p></div> : null}
      </div>
      </div>
      <div className="hidden xl:sticky xl:top-24 xl:flex xl:flex-col xl:gap-5">
        <PredictionLeaderboard entries={leaderboard} />
        <PredictionAdSlot />
      </div>
      {dialog ? (
        <BetAmountDialog
          dialog={dialog}
          balance={balance ?? 0}
          stake={stake}
          pending={isPending}
          onStakeChange={setStake}
          onClose={() => setDialog(null)}
          onSubmit={submitBet}
          onCancelBet={cancelBet}
        />
      ) : null}
      </div>
    </div>
  );
}

function PredictionAdSlot({ className = "" }: { className?: string }) {
  const enabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLE_PREDICTIONS === "true";
  return (
    <AdSlot
      enabled={enabled}
      placement="prediction"
      format="rectangle"
      className={`h-[100px] xl:h-[250px] xl:max-w-[300px] ${className}`}
    />
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`h-9 shrink-0 rounded-lg px-3.5 text-[13px] font-bold transition active:scale-[0.98] ${active ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)]"}`}>{children}</button>;
}

function TeamChoice({ team, percent, odds, selected, disabled, onClick, right = false }: { team?: Team; percent: number; odds: number | null; selected: boolean; disabled: boolean; onClick: () => void; right?: boolean }) {
  const color = teamColor(team);
  const mobilePercentNode = (
    <span className={`shrink-0 text-[17px] font-black leading-none tabular-nums text-[var(--ui-ink)] transition-colors sm:text-[26px] ${disabled ? "" : "group-hover:text-[var(--prediction-choice-color)]"}`}>
      {percent}<span className="ml-0.5 text-[12px] text-[var(--ui-muted)] sm:text-sm">%</span>
    </span>
  );
  const desktopPercentNode = (
    <span className={`hidden shrink-0 text-xl font-black leading-none tabular-nums text-[var(--ui-ink)] transition-colors xl:inline sm:text-[26px] ${disabled ? "" : "group-hover:text-[var(--prediction-choice-color)]"}`}>
      {percent}<span className="ml-0.5 text-[13px] text-[var(--ui-muted)] sm:text-sm">%</span>
    </span>
  );
  const oddsNode = <>{odds === null ? "1" : odds.toFixed(2)}<span className="text-sm">&nbsp;배</span></>;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !team}
      className={`group relative flex min-w-0 items-center gap-1.5 px-2 py-0 text-left transition active:scale-[0.99] disabled:cursor-default disabled:active:scale-100 sm:gap-3 sm:px-5 xl:gap-3 ${right ? "text-right xl:flex-row-reverse" : ""}`}
      style={{ "--prediction-choice-color": color } as React.CSSProperties}
      aria-pressed={selected}
      title={selected ? "다시 누르면 선택 취소" : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 xl:hidden">
        {right ? mobilePercentNode : null}
        <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${right ? "flex-row-reverse justify-start" : ""}`}>
          <TeamLogo team={team} size="h-7 w-7 sm:h-10 sm:w-10" plain themeAware />
          <span className={`flex min-w-0 items-baseline gap-1 ${right ? "flex-row-reverse" : ""}`}>
            <span className={`min-w-0 truncate text-[15px] font-black text-[var(--ui-ink)] transition-colors sm:text-xl ${disabled ? "" : "group-hover:text-[var(--prediction-choice-color)]"}`}>{team?.shortName ?? "TBD"}</span>
            <span className="shrink-0 text-[11px] font-bold text-[var(--ui-muted)] sm:text-[13px]">{odds === null ? "1.00" : odds.toFixed(2)}<span className="text-[10px] sm:text-[12px]">{"\u00a0\ubc30"}</span></span>
          </span>
        </span>
        {right ? null : mobilePercentNode}
      </span>
      <span className={`hidden min-w-0 flex-1 items-center gap-3 xl:flex ${right ? "xl:flex-row-reverse" : ""}`}>
        <TeamLogo team={team} size="h-10 w-10" plain themeAware />
        <span className={`truncate text-xl font-black text-[var(--ui-ink)] transition-colors ${disabled ? "" : "group-hover:text-[var(--prediction-choice-color)]"}`}>{team?.shortName ?? "TBD"}</span>
        <span className="flex shrink-0 items-center text-lg font-bold text-[var(--ui-muted)]">{oddsNode}</span>
      </span>
      {desktopPercentNode}
    </button>
  );
}
function PredictionLeaderboard({ entries }: { entries: PredictionRanking[] }) {
  return (
    <aside className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 dark:bg-[var(--ui-surface-muted)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--ui-muted)]">USER RANKING</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ui-ink)]">유저 랭킹</h2>
        </div>
        <span className="text-[13px] font-bold text-[var(--ui-muted)]">예측 수익</span>
      </div>
      <ol className="mt-4 divide-y divide-[var(--ui-border)]">
        {entries.map((entry) => (
          <li key={entry.userId} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 py-3 text-sm">
            <span className={`font-black ${entry.rank <= 3 ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]"}`}>{entry.rank}</span>
            <span className="truncate font-bold text-[var(--ui-text)]">{entry.nickname}</span>
            <span className={`font-black tabular-nums ${entry.profit > 0 ? "text-emerald-600" : entry.profit < 0 ? "text-red-500" : "text-[var(--ui-ink)]"}`}>{entry.profit > 0 ? "+" : ""}{entry.profit.toLocaleString("ko-KR")} LP</span>
          </li>
        ))}
      </ol>
      {!entries.length ? <p className="py-8 text-center text-sm text-[var(--ui-muted)]">랭킹 데이터가 없습니다.</p> : null}
      <p className="mt-3 text-[13px] leading-5 text-[var(--ui-muted)]">한 번 이상 LP 예측에 참여한 유저를 순수익 기준으로 표시합니다.</p>
    </aside>
  );
}

function BetAmountDialog({
  dialog,
  balance,
  stake,
  pending,
  onStakeChange,
  onClose,
  onSubmit,
  onCancelBet,
}: {
  dialog: BetDialog;
  balance: number;
  stake: string;
  pending: boolean;
  onStakeChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onCancelBet: () => void;
}) {
  const amount = Number(stake);
  const maxStake = predictionMaxStake(balance);
  const valid = Number.isSafeInteger(amount) && amount >= 100 && amount <= maxStake;
  const presets = [0.25, 0.5, 0.75, 1];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:px-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="w-full max-w-md rounded-t-[24px] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5" role="dialog" aria-modal="true" aria-labelledby="bet-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-[var(--ui-muted)]">LP PREDICTION</p>
            <h2 id="bet-dialog-title" className="mt-1 text-xl font-black text-[var(--ui-ink)]">{dialog.teamName} 승리 예측</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" aria-label="닫기"><X size={18} /></button>
        </div>

        {dialog.existingBet ? (
          <div className="mt-6 rounded-xl bg-[var(--ui-surface-muted)] p-4">
            <p className="text-sm font-bold text-[var(--ui-ink)]">이미 이 경기에 {dialog.existingBet.stake.toLocaleString("ko-KR")} LP를 사용했습니다.</p>
            <p className="mt-1 text-[13px] text-[var(--ui-muted)]">팀이나 금액을 바꾸려면 기존 예측을 취소한 뒤 다시 참여해 주세요.</p>
            <button type="button" onClick={onCancelBet} disabled={pending} className="mt-4 h-10 w-full rounded-lg border border-red-500/30 text-sm font-bold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50">예측 취소하고 LP 환불</button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-end justify-between gap-3">
              <label htmlFor="prediction-stake" className="text-sm font-bold text-[var(--ui-ink)]">사용할 LP</label>
              <span className="text-[13px] font-semibold text-[var(--ui-muted)]">1회 한도 {maxStake.toLocaleString("ko-KR")} LP</span>
            </div>
            <div className="mt-2 flex h-14 items-center rounded-xl border border-[var(--ui-border)] px-4 focus-within:border-[var(--ui-ink)]">
              <input id="prediction-stake" type="number" min={100} max={maxStake} step={100} value={stake} onChange={(event) => onStakeChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-2xl font-black tabular-nums text-[var(--ui-ink)] outline-none" />
              <span className="text-sm font-black text-[var(--ui-muted)]">LP</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {presets.map((ratio) => <button key={ratio} type="button" onClick={() => onStakeChange(String(Math.max(100, Math.floor((maxStake * ratio) / 100) * 100)))} className="h-9 rounded-lg bg-[var(--ui-surface-muted)] text-[13px] font-bold text-[var(--ui-text)] hover:opacity-80">{ratio === 1 ? "최대" : `${ratio * 100}%`}</button>)}
            </div>
            <p className={`mt-3 text-[13px] font-semibold ${valid ? "text-[var(--ui-muted)]" : "text-red-500"}`}>{valid ? `보유 ${balance.toLocaleString("ko-KR")} LP · 경기당 최대 20%, 상한 5,000 LP` : `100 LP 이상 ${maxStake.toLocaleString("ko-KR")} LP 이하로 입력해 주세요.`}</p>
            <button type="button" onClick={onSubmit} disabled={!valid || pending} className="mt-5 h-12 w-full rounded-xl bg-[var(--ui-ink)] text-sm font-black text-[var(--ui-surface)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{pending ? "처리 중..." : `${amount.toLocaleString("ko-KR")} LP로 확정`}</button>
          </>
        )}
      </section>
    </div>
  );
}
