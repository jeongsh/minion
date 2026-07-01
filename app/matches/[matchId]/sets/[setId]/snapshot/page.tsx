import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAllPlayers,
  getAllTeams,
  getFanRatings,
  getMatchById,
  getPlayerStatLines,
  getSetById,
  getTournaments,
} from "@/lib/data/lck";
import { isSetRatingSnapshotReady } from "@/lib/set-status";
import type { FanRating, Player, Team } from "@/lib/types";
import { fanRatingLeader, formatDateTime, matchHref, setHref, teamLabel } from "@/lib/view-data";

export const dynamic = "force-dynamic";

const POSITION_ORDER = new Map<string, number>(
  ["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [position, index]),
);

function averageRating(ratings: FanRating[]) {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
}

function playerInitial(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ player, size = "md" }: { player?: Player; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16" : "h-10 w-10";

  if (player?.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.profileImageUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-md object-cover object-top`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-md border border-border bg-surface-muted text-xs font-semibold`}
      aria-hidden="true"
    >
      {player ? playerInitial(player.name) : "-"}
    </span>
  );
}

function TeamLogo({ team }: { team?: Team }) {
  if (team?.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={team.logoUrl} alt={team.name} className="h-8 w-8 object-contain" />
    );
  }

  return (
    <span className="grid h-8 w-8 place-items-center rounded bg-surface-muted text-[10px] font-bold text-muted">
      {team?.shortName.slice(0, 3) ?? "-"}
    </span>
  );
}

function RatingRow({
  player,
  ratings,
  align = "left",
}: {
  player?: Player;
  ratings: FanRating[];
  align?: "left" | "right";
}) {
  const average = averageRating(ratings);

  return (
    <div
      className={`flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Avatar player={player} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{player?.name ?? "-"}</p>
        <p className="text-xs text-muted">{ratings.length}개 평점</p>
      </div>
      <p className="text-lg font-semibold tabular-nums">
        {average == null ? "-" : average.toFixed(1)}
      </p>
    </div>
  );
}

export default async function SetRatingSnapshotPage({
  params,
}: {
  params: Promise<{ matchId: string; setId: string }>;
}) {
  const { matchId, setId } = await params;
  const [match, set] = await Promise.all([getMatchById(matchId), getSetById(setId)]);

  if (!match || !set || set.matchId !== match.id) {
    notFound();
  }

  const [teams, players, statLines, fanRatings, tournaments] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getPlayerStatLines(set.id),
    getFanRatings(),
    getTournaments(),
  ]);

  const tournamentName = tournaments.find((item) => item.id === match.tournamentId)?.name;
  const teamA = teams.find((team) => team.id === set.blueTeamId);
  const teamB = teams.find((team) => team.id === set.redTeamId);
  const setRatings = fanRatings.filter((rating) => rating.setId === set.id);

  const shellClass = "mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10";

  if (!isSetRatingSnapshotReady(set)) {
    return (
      <main className={shellClass}>
        <section className="rounded-md border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-semibold">아직 스냅샷을 준비하고 있어요.</p>
          <p className="mt-2 text-sm text-muted">
            커뮤니티 공유용 스냅샷은 경기 종료 20분 후부터 공개됩니다.
          </p>
          <Link
            href={setHref(match, set)}
            className="mt-5 inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            세트 상세로 이동
          </Link>
        </section>
      </main>
    );
  }

  const orderLines = (teamId: string) =>
    statLines
      .filter((line) => line.teamId === teamId)
      .sort(
        (a, b) =>
          (POSITION_ORDER.get(a.position) ?? 99) - (POSITION_ORDER.get(b.position) ?? 99),
      );
  const blueLines = orderLines(set.blueTeamId);
  const redLines = orderLines(set.redTeamId);
  const ratingsForPlayer = (playerId: string) =>
    setRatings.filter((rating) => rating.playerId === playerId);

  const leader = fanRatingLeader(setRatings);
  const leaderPlayer = leader ? players.find((player) => player.id === leader.playerId) : undefined;
  const reviewRows = setRatings
    .filter((rating) => rating.review)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const teamColumn = (team: Team | undefined, lines: typeof blueLines, align: "left" | "right") => (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <div
        className={`flex items-center gap-2 border-b border-border px-3 py-2.5 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <TeamLogo team={team} />
        <strong className="text-sm">{team?.shortName ?? "TBD"}</strong>
      </div>
      {lines.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">평점 대상 선수가 없습니다.</p>
      ) : (
        lines.map((line) => (
          <RatingRow
            key={`${line.setId}-${line.playerId}`}
            player={players.find((player) => player.id === line.playerId)}
            ratings={ratingsForPlayer(line.playerId)}
            align={align}
          />
        ))
      )}
    </section>
  );

  return (
    <main className={shellClass}>
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-semibold text-accent">팬 평점 스냅샷</p>
          <p className="mt-0.5 text-xs text-muted">
            {tournamentName ?? match.name} · {formatDateTime(match.matchDate)}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <TeamLogo team={teamA} />
            <span className="text-sm font-semibold">{teamA?.shortName ?? "TBD"}</span>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">
              {set.blueKills ?? "-"} : {set.redKills ?? "-"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{set.setNumber}세트</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <TeamLogo team={teamB} />
            <span className="text-sm font-semibold">{teamB?.shortName ?? "TBD"}</span>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase text-muted">SET POG</p>
        {leader ? (
          <div className="mt-3 flex items-center gap-4">
            <Avatar player={leaderPlayer} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{leaderPlayer?.name ?? "-"}</p>
              <p className="mt-0.5 text-sm text-muted">
                {teamLabel(teams, leaderPlayer?.teamId)} · {leader.count}개 평점
              </p>
            </div>
            <p className="ml-auto text-3xl font-semibold tabular-nums">
              {leader.average.toFixed(1)}
              <span className="text-sm text-muted"> / 5</span>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">아직 집계된 평점이 없습니다.</p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {teamColumn(teamA, blueLines, "left")}
        {teamColumn(teamB, redLines, "right")}
      </section>

      {reviewRows.length > 0 ? (
        <section className="rounded-md border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">한줄평</h2>
          <div className="mt-3 grid gap-2">
            {reviewRows.map((rating) => {
              const player = players.find((item) => item.id === rating.playerId);
              return (
                <div
                  key={rating.id}
                  className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{player?.name ?? "-"}</span>
                  <span className="font-semibold tabular-nums text-muted">
                    {rating.rating.toFixed(1)}
                  </span>
                  <span className="min-w-0 flex-1 text-muted">{rating.review}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>LCKHUB 팬 평점</span>
        <Link href={matchHref(match)} className="font-semibold hover:text-foreground">
          매치 상세 보기 &gt;
        </Link>
      </div>
    </main>
  );
}
