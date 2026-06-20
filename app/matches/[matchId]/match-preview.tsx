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
    form: recent.map((match) => (match.winnerTeamId === teamId ? "W" : "L")).join(" ") || "-",
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

function buildPreviewLines({
  teamAName,
  teamBName,
  teamARecent,
  teamBRecent,
  h2h,
}: {
  teamAName: string;
  teamBName: string;
  teamARecent: ReturnType<typeof teamRecentRecord>;
  teamBRecent: ReturnType<typeof teamRecentRecord>;
  h2h: Match[];
}) {
  const teamAEdge = teamARecent.wins - teamBRecent.wins;

  if (teamARecent.games === 0 && teamBRecent.games === 0) {
    return [
      `${teamAName}와 ${teamBName} 모두 최근 공식 데이터가 충분하지 않아 초반 운영 안정성이 핵심 변수입니다.`,
      "승부예측은 경기 시작 전까지 열려 있으니 라인업 공개 이후 흐름을 다시 확인할 필요가 있습니다.",
    ];
  }

  const leadingTeam = teamAEdge >= 0 ? teamAName : teamBName;
  const trailingTeam = teamAEdge >= 0 ? teamBName : teamAName;

  return [
    `최근 5경기 흐름은 ${leadingTeam} 쪽이 조금 더 안정적이지만, ${trailingTeam}도 한타 변수를 만들 여지는 충분합니다.`,
    h2h.length > 0
      ? `최근 맞대결 ${h2h.length}경기 기준으로는 초반 세트 주도권이 승부예측의 가장 큰 분기점입니다.`
      : `최근 맞대결 표본이 적어 당일 밴픽과 첫 세트 경기력이 예측 신뢰도를 크게 좌우합니다.`,
  ];
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
    <div className="rounded-md border border-border bg-surface p-4">
      <h3 className="text-lg font-semibold">{label}</h3>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-muted">최근 5전</dt>
          <dd className="mt-1 font-semibold">{record.games > 0 ? `${record.wins}-${record.losses}` : "-"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">세트 득실</dt>
          <dd className="mt-1 font-semibold tabular-nums">{summary.setDiff > 0 ? `+${summary.setDiff}` : summary.setDiff}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted">평균 킬</dt>
          <dd className="mt-1 font-semibold tabular-nums">{summary.avgKills > 0 ? summary.avgKills.toFixed(1) : "-"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted">폼 {record.form}</p>
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
  const previewLines = buildPreviewLines({ teamAName, teamBName, teamARecent, teamBRecent, h2h });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="match-ai-preview">
          <p className="text-xs font-semibold uppercase text-muted">AI preview</p>
          <h2 id="match-ai-preview" className="mt-1 text-xl font-semibold">
            {teamAName} vs {teamBName}
          </h2>
          <div className="mt-4 space-y-2 text-sm leading-6 text-muted">
            {previewLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2" aria-label="양팀 전력비교">
          <TeamPowerCard label={teamAName} record={teamARecent} summary={teamASummary} />
          <TeamPowerCard label={teamBName} record={teamBRecent} summary={teamBSummary} />
        </section>

        <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="head-to-head">
          <h2 id="head-to-head" className="text-lg font-semibold">
            최근 맞대결
          </h2>
          <div className="mt-4 flex flex-col divide-y divide-border">
            {h2h.length === 0 ? (
              <p className="py-3 text-sm text-muted">최근 맞대결 데이터가 아직 충분하지 않습니다.</p>
            ) : (
              h2h.map((item) => (
                <div key={item.id} className="grid gap-2 py-3 text-sm md:grid-cols-[9rem_1fr_auto] md:items-center">
                  <span className="text-muted">{formatDateTime(item.matchDate)}</span>
                  <strong>
                    {teamLabel(teams, item.teamAId)} {item.teamAScore ?? "-"} : {item.teamBScore ?? "-"}{" "}
                    {teamLabel(teams, item.teamBId)}
                  </strong>
                  <span className="font-semibold text-accent">{teamLabel(teams, item.winnerTeamId)} 승</span>
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
