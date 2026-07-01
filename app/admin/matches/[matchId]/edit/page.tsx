import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import {
  getAllPlayers,
  getAllTeams,
  getMatchById,
  getSetDataCompletionBySetId,
  getSetsByMatchId,
  getStages,
  getTournaments,
} from "@/lib/data/lck";
import { matchStatusLabel } from "@/lib/match-display";
import { setStatusLabel } from "@/lib/set-status";
import { durationLabel, matchHref, matchRouteId, teamLabel } from "@/lib/view-data";

import { overrideMatchResultAction, updateMatchAction } from "../../actions";
import { MatchFields } from "../../match-fields";
import { MatchDataSyncPanel } from "./match-data-sync-panel";

export default async function AdminMatchEditPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);

  if (!match) {
    notFound();
  }

  const [teams, players, tournaments, stages, sets] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getTournaments(),
    getStages(),
    getSetsByMatchId(match.id),
  ]);
  const completionBySetId = Object.fromEntries(
    await getSetDataCompletionBySetId(sets.map((set) => set.id)),
  );

  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;
  const hasLeaguepediaMatchId = Boolean(match.leaguepediaMatchId);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="경기 관리" title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)}`} />
        <div className="flex items-center gap-4 text-sm font-medium text-muted">
          <Link href="/admin/matches" className="hover:text-foreground hover:underline">
            ← 경기 목록
          </Link>
          <Link href={matchHref(match)} className="hover:text-foreground hover:underline">
            공개 페이지
          </Link>
        </div>
      </div>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">경기 기본정보</h2>
        <p className="mt-2 text-sm text-muted">
          현재 상태 <span className="font-semibold text-foreground">{matchStatusLabel(match.status)}</span> · 스코어{" "}
          <span className="font-semibold text-foreground">
            {match.teamAScore ?? "-"} : {match.teamBScore ?? "-"}
          </span>{" "}
          · 최종 승자{" "}
          <span className="font-semibold text-foreground">
            {match.winnerTeamId ? teamLabel(teams, match.winnerTeamId) : "없음"}
          </span>
          <span className="ml-1 text-xs">(세트 결과로부터 자동 계산됩니다)</span>
        </p>
        <form action={updateMatchAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="redirectTo" value={adminMatchPath} />
          <MatchFields
            match={match}
            teams={teams}
            tournaments={tournaments}
            stages={stages}
            players={players}
          />
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              기본정보 저장
            </button>
          </div>
        </form>

        <details className="mt-6 rounded-md border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold hover:bg-surface-muted">
            고급 설정 · 결과 수동 보정
          </summary>
          <div className="border-t border-border p-4">
            <p className="mb-3 text-xs text-muted">
              세트 결과가 있으면 스코어/상태/승자는 다음 세트 저장·동기화 시 자동으로 다시 계산되어 여기서
              바꾼 값을 덮어씁니다. 세트 데이터가 없거나 예외적으로 결과를 임시 고정해야 할 때만 사용하세요.
            </p>
            <form action={overrideMatchResultAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input type="hidden" name="matchId" value={match.id} />
              <input type="hidden" name="redirectTo" value={adminMatchPath} />
              <label className="flex flex-col gap-2 text-sm font-medium">
                상태
                <select
                  name="status"
                  defaultValue={match.status}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="scheduled">예정</option>
                  <option value="live">진행 중</option>
                  <option value="completed">종료</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                팀 A 스코어
                <input
                  name="teamAScore"
                  type="number"
                  min="0"
                  defaultValue={match.teamAScore ?? ""}
                  className="rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                팀 B 스코어
                <input
                  name="teamBScore"
                  type="number"
                  min="0"
                  defaultValue={match.teamBScore ?? ""}
                  className="rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                최종 승자
                <select
                  name="winnerTeamId"
                  defaultValue={match.winnerTeamId ?? ""}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="">없음</option>
                  {[match.teamAId, match.teamBId].filter(Boolean).map((teamId) => (
                    <option key={teamId} value={teamId}>
                      {teamLabel(teams, teamId)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
                >
                  수동 보정 저장
                </button>
              </div>
            </form>
          </div>
        </details>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">경기 데이터 · 세트 결과 ({sets.length}개)</h2>
          {!hasLeaguepediaMatchId ? (
            <Link
              href={`${adminMatchPath}/sets/new`}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              세트 추가
            </Link>
          ) : null}
        </div>

        <MatchDataSyncPanel
          matchId={match.id}
          hasLeaguepediaMatchId={hasLeaguepediaMatchId}
          bestOf={match.bestOf ?? null}
          sets={sets.map((set) => ({
            id: set.id,
            status: set.status,
            leaguepediaGameId: set.leaguepediaGameId ?? null,
            resultRecordedAt: set.resultRecordedAt ?? null,
          }))}
          completionBySetId={completionBySetId}
        />

        <DataTable
          rows={sets}
          emptyText="아직 등록된 세트 결과가 없습니다."
          columns={[
            {
              key: "set",
              label: "세트",
              render: (row) => (
                <Link
                  href={`${adminMatchPath}/sets/${row.id}/edit`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {row.setNumber}세트
                </Link>
              ),
            },
            { key: "status", label: "상태", render: (row) => setStatusLabel(row.status) },
            { key: "winner", label: "승리 팀", render: (row) => teamLabel(teams, row.winnerTeamId) },
            { key: "side", label: "진영", render: (row) => `${teamLabel(teams, row.blueTeamId)} / ${teamLabel(teams, row.redTeamId)}` },
            { key: "time", label: "경기 시간", render: (row) => durationLabel(row.durationSeconds) },
            {
              key: "completion",
              label: "데이터 완성도",
              render: (row) => {
                const completion = completionBySetId[row.id];
                if (!completion) return "-";
                return `픽 ${completion.pickCount}/10 · 밴 ${completion.banCount}/10 · 스탯 ${completion.playerStatCount}/10`;
              },
            },
            {
              key: "timeline",
              label: "타임라인",
              render: (row) => {
                const count = completionBySetId[row.id]?.timelineEventCount ?? 0;
                return count > 0 ? `있음 (${count})` : "없음";
              },
            },
          ]}
        />
        {hasLeaguepediaMatchId ? (
          <p className="text-xs text-muted">
            이미 Leaguepedia와 연동된 경기입니다. 세트를 직접 추가해야 한다면{" "}
            <Link href={`${adminMatchPath}/sets/new`} className="underline hover:text-foreground">
              수동 세트 추가
            </Link>
            를 사용하세요.
          </p>
        ) : null}
      </section>
    </main>
  );
}
