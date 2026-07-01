import type { FanMatchPrediction, Match, Team } from "@/lib/types";
import { formatDateTime, teamLabel } from "@/lib/view-data";

type VoteAction = (formData: FormData) => Promise<void>;

function voteCount(predictions: FanMatchPrediction[], teamId: string) {
  return predictions.filter((prediction) => prediction.teamId === teamId).length;
}

export function WinnerPredictionPoll({
  match,
  teams,
  predictions,
  voterKey,
  closed,
  action,
}: {
  match: Match;
  teams: Team[];
  predictions: FanMatchPrediction[];
  voterKey?: string;
  closed: boolean;
  action: VoteAction;
}) {
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const hasTbd =
    !teams.some((team) => team.id === match.teamAId) ||
    !teams.some((team) => team.id === match.teamBId);
  const votingDisabled = closed || hasTbd;
  const teamACount = voteCount(predictions, match.teamAId);
  const teamBCount = voteCount(predictions, match.teamBId);
  const total = teamACount + teamBCount;
  const teamAPercent = total > 0 ? Math.round((teamACount / total) * 100) : 0;
  const teamBPercent = total > 0 ? 100 - teamAPercent : 0;
  const myVote = voterKey
    ? predictions.find((prediction) => prediction.voterKey === voterKey)?.teamId
    : undefined;

  const rows = [
    { teamId: match.teamAId, name: teamAName, count: teamACount, percent: teamAPercent },
    { teamId: match.teamBId, name: teamBName, count: teamBCount, percent: teamBPercent },
  ];

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="winner-prediction">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="winner-prediction" className="text-lg font-semibold">
            승자예측
          </h2>
          <p className="mt-1 text-xs text-muted">
            {hasTbd
              ? "대진이 확정되면 예측이 열립니다."
              : closed
                ? "경기 시작으로 투표가 마감되었습니다."
                : `${formatDateTime(match.matchDate)} 자동 마감`}
          </p>
        </div>
        <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
          {total.toLocaleString("ko-KR")}표
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.teamId} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <strong>{row.name}</strong>
              <span className="text-muted">
                {row.percent}% · {row.count.toLocaleString("ko-KR")}표
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
            </div>
            {votingDisabled ? (
              <div className="rounded-md border border-border px-3 py-2 text-center text-sm font-semibold text-muted">
                {hasTbd ? "상대 미정" : myVote === row.teamId ? "내 선택" : "마감"}
              </div>
            ) : (
              <form action={action}>
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="teamId" value={row.teamId} />
                <button
                  type="submit"
                  className={`w-full rounded-md border px-3 py-2 text-sm font-semibold ${
                    myVote === row.teamId
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border hover:bg-surface-muted"
                  }`}
                >
                  {myVote === row.teamId ? "선택됨" : `${row.name} 승리 예측`}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
