import type { Match, SetResult, Team } from "@/lib/types";
import { formatDateTime, teamLabel } from "@/lib/view-data";
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

function teamSetSummary(sets: SetResult[], teamId: string) {
  const teamSets = sets.filter((set) => set.blueTeamId === teamId || set.redTeamId === teamId);
  const wins = teamSets.filter((set) => set.winnerTeamId === teamId).length;
  const losses = teamSets.filter((set) => set.winnerTeamId && set.winnerTeamId !== teamId).length;
  const kills = teamSets.reduce((sum, set) => {
    const value = set.blueTeamId === teamId ? set.blueKills : set.redKills;
    return sum + (value ?? 0);
  }, 0);

  return {
    setDiff: wins - losses,
    avgKills: teamSets.length > 0 ? kills / teamSets.length : 0,
  };
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] font-bold text-[var(--ui-muted)]">{label}</dt>
      <dd className="mt-1.5 text-xl font-black tabular-nums text-[var(--ui-ink)]">{value}</dd>
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
    <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
      <h3 className="text-[15px] font-black text-[var(--ui-ink)]">{label}</h3>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <StatCell label="최근 5전" value={record.games > 0 ? `${record.wins}-${record.losses}` : "-"} />
        <StatCell label="세트 득실" value={summary.setDiff > 0 ? `+${summary.setDiff}` : String(summary.setDiff)} />
        <StatCell label="평균 킬" value={summary.avgKills > 0 ? summary.avgKills.toFixed(1) : "-"} />
      </dl>
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--ui-border)] pt-4">
        <span className="text-[13px] font-bold text-[var(--ui-muted)]">최근 폼</span>
        <div className="flex gap-1">
          {record.form.length ? (
            record.form.map((result, index) => (
              <span
                key={index}
                className={`grid h-5 w-5 place-items-center rounded-full text-xs font-black ${
                  result === "W"
                    ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                    : "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"
                }`}
              >
                {result}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-[var(--ui-muted)]">-</span>
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
}: {
  match: Match;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
  poll: ReactNode;
}) {
  const previousMatches = completedBefore(matches, match);
  const h2h = previousMatches
    .filter((item) => isSamePair(item, match.teamAId, match.teamBId))
    .slice(0, 5);
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const teamARecent = teamRecentRecord(previousMatches, match.teamAId);
  const teamBRecent = teamRecentRecord(previousMatches, match.teamBId);
  const teamASummary = teamSetSummary(sets, match.teamAId);
  const teamBSummary = teamSetSummary(sets, match.teamBId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        <section className="grid gap-4 md:grid-cols-2" aria-label="양팀 전력비교">
          <TeamPowerCard label={teamAName} record={teamARecent} summary={teamASummary} />
          <TeamPowerCard label={teamBName} record={teamBRecent} summary={teamBSummary} />
        </section>

        <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5" aria-labelledby="head-to-head">
          <h2 id="head-to-head" className="text-[15px] font-black text-[var(--ui-ink)]">
            최근 맞대결
          </h2>
          <div className="mt-2 flex flex-col divide-y divide-[var(--ui-border)]">
            {h2h.length === 0 ? (
              <p className="py-3 text-sm text-[var(--ui-muted)]">최근 맞대결 데이터가 아직 충분하지 않습니다.</p>
            ) : (
              h2h.map((item) => (
                <div key={item.id} className="grid gap-1 py-3 md:grid-cols-[9rem_1fr_auto] md:items-center">
                  <span className="text-[13px] font-semibold text-[var(--ui-muted)]">{formatDateTime(item.matchDate)}</span>
                  <strong className="text-sm font-black text-[var(--ui-ink)]">
                    {teamLabel(teams, item.teamAId)}{" "}
                    <span className="tabular-nums">{item.teamAScore ?? "-"} : {item.teamBScore ?? "-"}</span>{" "}
                    {teamLabel(teams, item.teamBId)}
                  </strong>
                  <span className="text-[13px] font-bold text-[var(--ui-muted)]">
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
  );
}
