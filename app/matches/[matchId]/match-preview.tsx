import type { Match, SetResult, Team } from "@/lib/types";
import { formatDateTime, teamLabel } from "@/lib/view-data";
import type { MatchAiPreview } from "@/lib/match-preview-ai";
import type { ReactNode } from "react";

function isSamePair(match: Match, teamAId: string, teamBId: string) {
  return (
    (match.teamAId === teamAId && match.teamBId === teamBId) ||
    (match.teamAId === teamBId && match.teamBId === teamAId)
  );
}

function completedBefore(matches: Match[], currentMatch: Match) {
  const currentTime = new Date(currentMatch.matchDate).getTime();
  return matches
    .filter(
      (match) =>
        match.id !== currentMatch.id &&
        match.status === "completed" &&
        new Date(match.matchDate).getTime() < currentTime,
    )
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
}

function teamRecentRecord(matches: Match[], teamId: string) {
  const recent = matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .slice(0, 5);
  const wins = recent.filter((match) => match.winnerTeamId === teamId).length;
  const losses = recent.length - wins;

  return {
    games: recent.length,
    wins,
    losses,
    form: recent.map((match) => (match.winnerTeamId === teamId ? "W" : "L")) as ("W" | "L")[],
  };
}

function teamSetSummary(sets: SetResult[], matches: Match[], teamId: string) {
  const recentMatches = matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .slice(0, 5);
  const recentMatchIds = new Set(recentMatches.map((match) => match.id));
  const teamSets = sets.filter(
    (set) =>
      recentMatchIds.has(set.matchId) &&
      (set.blueTeamId === teamId || set.redTeamId === teamId),
  );
  const score = recentMatches.reduce(
    (total, item) => {
      const own = item.teamAId === teamId ? item.teamAScore : item.teamBScore;
      const opponent = item.teamAId === teamId ? item.teamBScore : item.teamAScore;
      total.wins += own ?? 0;
      total.losses += opponent ?? 0;
      return total;
    },
    { wins: 0, losses: 0 },
  );
  const kills = teamSets.reduce((sum, set) => {
    const value = set.blueTeamId === teamId ? set.blueKills : set.redKills;
    return sum + (value ?? 0);
  }, 0);

  return {
    setDiff: score.wins - score.losses,
    avgKills: teamSets.length > 0 ? kills / teamSets.length : 0,
  };
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-[var(--ui-muted)]">{label}</dt>
      <dd className="mt-1 text-lg font-black tabular-nums text-[var(--ui-ink)]">{value}</dd>
    </div>
  );
}

function TeamPowerCard({
  label,
  record,
  summary,
}: {
  label: string;
  record: ReturnType<typeof teamRecentRecord>;
  summary: ReturnType<typeof teamSetSummary>;
}) {
  return (
    <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
      <h3 className="text-sm font-black text-[var(--ui-ink)]">{label}</h3>
      <dl className="mt-3 grid grid-cols-3 gap-2.5">
        <StatCell label="최근 5전" value={record.games > 0 ? `${record.wins}-${record.losses}` : "-"} />
        <StatCell label="세트 득실" value={summary.setDiff > 0 ? `+${summary.setDiff}` : String(summary.setDiff)} />
        <StatCell label="평균 킬" value={summary.avgKills > 0 ? summary.avgKills.toFixed(1) : "-"} />
      </dl>
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--ui-border)] pt-3">
        <span className="text-xs font-bold text-[var(--ui-muted)]">최근 폼</span>
        <div className="flex gap-1">
          {record.form.length ? (
            record.form.map((result, index) => (
              <span
                key={index}
                className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-medium ${
                  result === "W"
                    ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                    : "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"
                }`}
              >
                {result}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--ui-muted)]">-</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MatchPreview({
  match,
  teams,
  matches,
  sets,
  poll,
  aiPreview,
}: {
  match: Match;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
  poll: ReactNode;
  aiPreview: MatchAiPreview;
}) {
  const previousMatches = completedBefore(matches, match);
  const h2h = previousMatches
    .filter((item) => isSamePair(item, match.teamAId, match.teamBId))
    .slice(0, 5);
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const teamARecent = teamRecentRecord(previousMatches, match.teamAId);
  const teamBRecent = teamRecentRecord(previousMatches, match.teamBId);
  const teamASummary = teamSetSummary(sets, previousMatches, match.teamAId);
  const teamBSummary = teamSetSummary(sets, previousMatches, match.teamBId);

  return (
    <div className="flex flex-col gap-3">
      <section
        className="mobile-full-bleed overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] md:mx-0"
        aria-labelledby="ai-match-preview"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-2.5">
          <h2 id="ai-match-preview" className="text-sm font-black tracking-tight text-[var(--ui-ink)]">
            {aiPreview.source === "ai" ? "AI 경기 프리뷰" : "경기 프리뷰"}
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ui-muted)]">
            대진 난이도 반영
          </span>
        </div>
        <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.45fr)] md:items-start md:gap-5">
          <p className="text-[15px] font-semibold leading-7 text-[var(--ui-text)] sm:text-base">
            {aiPreview.summary}
          </p>
          <aside className="border-l-2 border-[var(--ui-ink)] pl-3">
            <p className="text-xs font-black text-[var(--ui-muted)]">눈여겨볼 곳</p>
            <p className="mt-1 text-sm font-black leading-6 text-[var(--ui-ink)]">
              {aiPreview.watchPoint}
            </p>
          </aside>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <section className="grid gap-3 md:grid-cols-2" aria-label="양팀 전력비교">
            <TeamPowerCard label={teamAName} record={teamARecent} summary={teamASummary} />
            <TeamPowerCard label={teamBName} record={teamBRecent} summary={teamBSummary} />
          </section>

          <section className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4" aria-labelledby="head-to-head">
            <h2 id="head-to-head" className="text-base font-black text-[var(--ui-ink)]">
              최근 맞대결
            </h2>
            <div className="mt-2 flex flex-col divide-y divide-[var(--ui-border)]">
              {h2h.length === 0 ? (
                <p className="py-2.5 text-sm text-[var(--ui-muted)]">
                  현재 수집된 기록 기준 첫 맞대결입니다. 최근 대진 난이도와 경기력으로 비교했습니다.
                </p>
              ) : (
                h2h.map((item) => (
                  <div key={item.id} className="grid gap-1 py-2.5 md:grid-cols-[8rem_1fr_auto] md:items-center">
                    <span className="text-xs font-semibold text-[var(--ui-muted)]">{formatDateTime(item.matchDate)}</span>
                    <strong className="text-sm font-black text-[var(--ui-ink)]">
                      {teamLabel(teams, item.teamAId)}{" "}
                      <span className="tabular-nums">{item.teamAScore ?? "-"} : {item.teamBScore ?? "-"}</span>{" "}
                      {teamLabel(teams, item.teamBId)}
                    </strong>
                    <span className="text-xs font-bold text-[var(--ui-muted)]">
                      {teamLabel(teams, item.winnerTeamId)} <span className="text-[var(--ui-ink)]">승</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">{poll}</div>
      </div>
    </div>
  );
}
