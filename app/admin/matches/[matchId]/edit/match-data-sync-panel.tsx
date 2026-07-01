"use client";

import { useState, useTransition } from "react";

import type { SetDataCompletion } from "@/lib/data/lck";
import { formatDateTime } from "@/lib/view-data";

import {
  checkMatchConsistencyAction,
  syncLeaguepediaMatchSetsAction,
  syncMatchDataAction,
  syncTimelineAction,
} from "../../actions";

type PanelSet = {
  id: string;
  status: string;
  leaguepediaGameId: string | null;
  resultRecordedAt: string | null;
};

type ChipTone = "done" | "partial" | "empty";

function Chip({ label, value, tone }: { label: string; value: string; tone: ChipTone }) {
  const toneClass =
    tone === "done"
      ? "border-green-600/40 bg-green-600/10 text-green-700"
      : tone === "partial"
        ? "border-yellow-600/40 bg-yellow-600/10 text-yellow-700"
        : "border-border bg-surface-muted text-muted";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {label} · {value}
    </span>
  );
}

function fractionTone(done: number, total: number): ChipTone {
  if (total === 0) return "empty";
  if (done >= total) return "done";
  return done > 0 ? "partial" : "empty";
}

export function MatchDataSyncPanel({
  matchId,
  hasLeaguepediaMatchId,
  bestOf,
  sets,
  completionBySetId,
}: {
  matchId: string;
  hasLeaguepediaMatchId: boolean;
  bestOf: number | null;
  sets: PanelSet[];
  completionBySetId: Record<string, SetDataCompletion>;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Bo5가 3승으로 조기 종료되는 등 실제로 필요한 세트 수가 bestOf보다 적을 수 있으므로,
  // "세트 결과" 완성도는 지금까지 기록된 세트가 전부 끝났는지로 판단한다(bestOf와 비교하지 않음).
  const finishedSets = sets.filter((set) => set.status === "finished" || set.status === "data_synced").length;
  const draftReadySets = sets.filter((set) => (completionBySetId[set.id]?.pickCount ?? 0) >= 10).length;
  const statReadySets = sets.filter((set) => (completionBySetId[set.id]?.playerStatCount ?? 0) >= 10).length;
  const timelineEligibleSets = sets.filter((set) => set.leaguepediaGameId);
  const timelineReadySets = timelineEligibleSets.filter(
    (set) => (completionBySetId[set.id]?.timelineEventCount ?? 0) > 0,
  ).length;
  const lastRecordedAt = sets
    .map((set) => set.resultRecordedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  function runSyncMatchData() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await syncMatchDataAction(matchId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { setsSummary, timelineSummary, timelineError, pomResult, pomError } = result;
      const parts = [
        `세트 ${setsSummary.upserted}개, 밴픽 ${setsSummary.picksBansUpserted}개, 선수 스탯 ${setsSummary.playerStatsUpserted}개 저장`,
      ];
      if (timelineSummary) {
        parts.push(`타임라인 세트 ${timelineSummary.setsProcessed}개 처리, 이벤트 ${timelineSummary.eventsInserted}개 저장`);
      } else if (timelineError) {
        parts.push(`타임라인 동기화 실패: ${timelineError}`);
      }
      if (pomResult?.updated) {
        parts.push(`공식 POM: ${pomResult.playerName}`);
      } else if (pomResult && !pomResult.updated && pomResult.reason === "no_pom_in_leaguepedia") {
        parts.push("공식 POM: Leaguepedia에 정보 없음");
      } else if (pomResult && !pomResult.updated && pomResult.reason === "player_not_found") {
        parts.push(`공식 POM: 선수 매칭 실패(${pomResult.mvpName ?? "-"})`);
      } else if (pomError) {
        parts.push(`공식 POM 동기화 실패: ${pomError}`);
      }
      setMessage(parts.join(" · "));
    });
  }

  function runSetsOnly() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await syncLeaguepediaMatchSetsAction(matchId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { summary } = result;
      setMessage(
        `세트 ${summary.upserted}개, 밴픽 ${summary.picksBansUpserted}개, 선수 스탯 ${summary.playerStatsUpserted}개 저장 완료`,
      );
    });
  }

  function runTimelineForceAll() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await syncTimelineAction(matchId, true);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { summary } = result;
      setMessage(`세트 ${summary.setsProcessed}개 처리, 이벤트 ${summary.eventsInserted}개 저장`);
    });
  }

  function runForceRefreshAll() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const setsResult = await syncLeaguepediaMatchSetsAction(matchId);
      if (!setsResult.ok) {
        setError(setsResult.error);
        return;
      }
      const timelineResult = await syncTimelineAction(matchId, true);
      const parts = [
        `세트 ${setsResult.summary.upserted}개, 밴픽 ${setsResult.summary.picksBansUpserted}개, 선수 스탯 ${setsResult.summary.playerStatsUpserted}개 저장`,
      ];
      if (timelineResult.ok) {
        parts.push(`타임라인 세트 ${timelineResult.summary.setsProcessed}개 처리, 이벤트 ${timelineResult.summary.eventsInserted}개 저장`);
      } else {
        parts.push(`타임라인 동기화 실패: ${timelineResult.error}`);
      }
      setMessage(parts.join(" · "));
    });
  }

  function runConsistencyCheck() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await checkMatchConsistencyAction(matchId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { diagnosis } = result;
      const issues = [
        diagnosis.matchMismatches.length > 0 ? `매치 스코어/상태 불일치 ${diagnosis.matchMismatches.length}건` : null,
        diagnosis.setStatusMismatches.length > 0 ? `세트 상태 불일치 ${diagnosis.setStatusMismatches.length}건` : null,
        diagnosis.setWinnerOutsideParticipants.length > 0
          ? `세트 승자가 참가팀 밖 ${diagnosis.setWinnerOutsideParticipants.length}건`
          : null,
        diagnosis.setTeamOutsideMatch.length > 0 ? `세트 팀이 매치 참가팀 밖 ${diagnosis.setTeamOutsideMatch.length}건` : null,
        diagnosis.setNumberAnomalies.length > 0 ? `세트 번호 이상 ${diagnosis.setNumberAnomalies.length}건` : null,
        diagnosis.incompletePlayerStats.length > 0 ? `불완전 선수 스탯 ${diagnosis.incompletePlayerStats.length}건` : null,
      ].filter((issue): issue is string => Boolean(issue));

      setMessage(issues.length > 0 ? `불일치 발견: ${issues.join(", ")}` : "불일치 없음 — 매치/세트 데이터가 서로 일치합니다.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip
          label="일정"
          value={bestOf ? "완료" : "일부 누락"}
          tone={bestOf ? "done" : "partial"}
        />
        <Chip
          label="세트 결과"
          value={sets.length === 0 ? "준비 안 됨" : finishedSets >= sets.length ? "완료" : "일부 누락"}
          tone={sets.length === 0 ? "empty" : fractionTone(finishedSets, sets.length)}
        />
        <Chip label="밴픽" value={`${draftReadySets}/${sets.length || 0}`} tone={fractionTone(draftReadySets, sets.length)} />
        <Chip label="선수 스탯" value={`${statReadySets}/${sets.length || 0}`} tone={fractionTone(statReadySets, sets.length)} />
        <Chip
          label="타임라인"
          value={`${timelineReadySets}/${timelineEligibleSets.length}`}
          tone={fractionTone(timelineReadySets, timelineEligibleSets.length)}
        />
        <Chip label="마지막 기록" value={lastRecordedAt ? formatDateTime(lastRecordedAt) : "없음"} tone="empty" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending || !hasLeaguepediaMatchId}
          onClick={runSyncMatchData}
          title={hasLeaguepediaMatchId ? undefined : "Leaguepedia Match ID가 없어 자동 동기화를 사용할 수 없습니다."}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          {isPending ? "동기화 중..." : "경기 데이터 동기화"}
        </button>

        <details className="relative" open={menuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted">
            ···
          </summary>
          <div className="absolute left-0 z-10 mt-2 flex w-64 flex-col gap-1 rounded-md border border-border bg-surface p-2 shadow-lg">
            <button
              type="button"
              disabled={isPending || !hasLeaguepediaMatchId}
              onClick={() => {
                setMenuOpen(false);
                runSetsOnly();
              }}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              세트 결과만 다시 가져오기
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setMenuOpen(false);
                runTimelineForceAll();
              }}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              모든 세트 타임라인 다시 가져오기
            </button>
            <button
              type="button"
              disabled={isPending || !hasLeaguepediaMatchId}
              onClick={() => {
                setMenuOpen(false);
                runForceRefreshAll();
              }}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              강제 전체 갱신
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setMenuOpen(false);
                runConsistencyCheck();
              }}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              데이터 일관성 재검사
            </button>
          </div>
        </details>
      </div>

      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
