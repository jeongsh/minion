import type { FanMatchPrediction, Match, Team } from "@/lib/types";
import { teamLabel } from "@/lib/view-data";

type VoteAction = (formData: FormData) => Promise<void>;

function voteCount(predictions: FanMatchPrediction[], teamId: string) {
  return predictions.filter((prediction) => prediction.teamId === teamId).length;
}

function predictionColor(team: Team | undefined, fallback: string) {
  const primary = team?.primaryColor || fallback;
  const match = primary.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);

  if (!match) return primary;

  const luminance = (0.2126 * Number.parseInt(match[1], 16) + 0.7152 * Number.parseInt(match[2], 16) + 0.0722 * Number.parseInt(match[3], 16)) / 255;
  return luminance < 0.16 && team?.secondaryColor ? team.secondaryColor : primary;
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
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const teamAColor = predictionColor(teamA, "#3b82f6");
  const teamBColor = predictionColor(teamB, "#ef4444");
  const hasTbd =
    !teams.some((team) => team.id === match.teamAId) ||
    !teams.some((team) => team.id === match.teamBId);
  const votingDisabled = closed || hasTbd;
  const teamACount = voteCount(predictions, match.teamAId);
  const teamBCount = voteCount(predictions, match.teamBId);
  const total = teamACount + teamBCount;
  const teamAPercent = total > 0 ? Math.round((teamACount / total) * 100) : 0;
  const teamBPercent = total > 0 ? 100 - teamAPercent : 0;
  const teamADisplayPercent = total > 0 ? teamAPercent : 50;
  const myVote = voterKey
    ? predictions.find((prediction) => prediction.voterKey === voterKey)?.teamId
    : undefined;

  const rows = [
    { teamId: match.teamAId, name: teamAName, count: teamACount, color: teamAColor },
    { teamId: match.teamBId, name: teamBName, count: teamBCount, color: teamBColor },
  ];

  return (
    <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5" aria-labelledby="winner-prediction">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="winner-prediction" className="text-[15px] font-black text-[var(--ui-ink)]">
            승자예측
          </h2>
          <p className="mt-1 text-[13px] font-semibold text-[var(--ui-muted)]">
            {hasTbd
              ? "대진이 확정되면 예측이 열립니다."
              : closed
                ? "경기가 종료되어 투표가 마감되었습니다."
                : "경기가 종료되면 자동 마감됩니다."}
          </p>
        </div>
        <span className="rounded-full bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-bold text-[var(--ui-muted)]">
          {total.toLocaleString("ko-KR")}표
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <strong className="text-sm font-black text-[var(--ui-ink)]">{teamAName}</strong>
            <p className="mt-1 text-[28px] font-black leading-none tabular-nums" style={{ color: teamAColor }}>{teamAPercent}%</p>
          </div>
          <div className="text-right">
            <strong className="text-sm font-black text-[var(--ui-ink)]">{teamBName}</strong>
            <p className="mt-1 text-[28px] font-black leading-none tabular-nums" style={{ color: teamBColor }}>{teamBPercent}%</p>
          </div>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]" aria-label={`${teamAName} ${teamAPercent}%, ${teamBName} ${teamBPercent}%`}>
          <span className="h-full transition-[width]" style={{ width: `${teamADisplayPercent}%`, backgroundColor: teamAColor }} />
          <span className="h-full flex-1" style={{ backgroundColor: teamBColor }} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.teamId} className="flex flex-col gap-2">
            {votingDisabled ? (
              <div className="rounded-lg border border-[var(--ui-border)] px-3 py-2.5 text-center text-sm font-bold text-[var(--ui-muted)]">
                {hasTbd ? "상대 미정" : myVote === row.teamId ? `내 선택 · ${row.count.toLocaleString("ko-KR")}표` : `마감 · ${row.count.toLocaleString("ko-KR")}표`}
              </div>
            ) : (
              <form action={action}>
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="teamId" value={row.teamId} />
                <button
                  type="submit"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors ${
                    myVote === row.teamId
                      ? "text-white"
                      : "border-[var(--ui-border)] text-[var(--ui-ink)] hover:bg-[var(--ui-card-hover)]"
                  }`}
                  style={myVote === row.teamId ? { borderColor: row.color, backgroundColor: row.color } : { borderColor: `color-mix(in srgb, ${row.color} 50%, var(--ui-border))` }}
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
