import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { championImage } from "@/lib/champions";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatingsByMatchId,
  getMatchById,
  getPlayerStatLines,
  getSetById,
  getTournaments,
} from "@/lib/data/lck";
import { formatFanRating } from "@/lib/fan-rating-display";
import { isSetRatingSnapshotReady } from "@/lib/set-status";
import type { Champion, FanRating, Player, PlayerPosition, Team } from "@/lib/types";
import { formatDateTime, setHref } from "@/lib/view-data";

import { SnapshotActions } from "./snapshot-actions";

export const dynamic = "force-dynamic";

// 세트 팬 평가를 이미지로 공유하기 위한 파생 화면. 경기 페이지와 내용이 겹치므로 색인 제외.
export const metadata: Metadata = { title: "세트 평가 스냅샷", robots: { index: false } };

const POSITION_ORDER = new Map<string, number>(
  ["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [position, index]),
);

const POSITION_ICON_SRC: Record<PlayerPosition, string> = {
  TOP: "/objectives/position-top.svg",
  JGL: "/objectives/position-jungle.svg",
  MID: "/objectives/position-middle.svg",
  BOT: "/objectives/position-bottom.svg",
  SUP: "/objectives/position-utility.svg",
};

function averageRating(ratings: FanRating[]) {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
}

function TeamLogo({ team, large = false }: { team?: Team; large?: boolean }) {
  const size = large ? "h-14 w-14" : "h-9 w-9";
  const logo = team?.logoWhiteUrl || team?.logoUrl;

  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={team?.name ?? "팀 로고"} className={`${size} object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]`} />
    );
  }

  return <span className={`${size} grid place-items-center rounded-full border border-white/25 text-[13px] font-medium text-white/60`}>팀</span>;
}

function SnapshotTeamBlock({ team, winner }: { team?: Team; winner: boolean }) {
  return (
    <div className={`flex flex-col items-center ${winner ? "opacity-100" : "opacity-55"}`}>
      <div className={winner ? "" : "grayscale"}>
        <TeamLogo team={team} large />
      </div>
      <strong className={`text-base font-black ${winner ? "text-white" : "text-white/60"}`}>{team?.shortName ?? "미정"}</strong>
    </div>
  );
}

function ScoreValue({ value, winner }: { value?: number | null; winner: boolean }) {
  return (
    <span className={winner ? "text-white" : "text-white/38"}>
      {value ?? "-"}
    </span>
  );
}

function PlayerMark({ player, champion }: { player?: Player; champion?: Champion }) {
  const image = championImage(champion);
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover" />
    );
  }

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-[10px] font-medium text-white/80">
      {player?.name.slice(0, 2).toUpperCase() ?? "-"}
    </span>
  );
}

function RatingPill({ value, opponentValue, isWinner }: { value: number | null; opponentValue: number | null; isWinner: boolean }) {
  const hasComparableRatings = value != null && opponentValue != null && value !== opponentValue;
  const isHigher = hasComparableRatings ? value > opponentValue : isWinner;
  const tone = isHigher ? "bg-[#ed3150]" : "bg-[#2968e8]";

  return (
    <strong className={`min-w-[46px] rounded-md px-2 py-1 text-center text-[17px] font-bold tabular-nums text-white shadow-lg ${tone}`}>
      {formatFanRating(value)}
    </strong>
  );
}

function PositionIcon({ position }: { position?: PlayerPosition }) {
  if (!position) return <span aria-hidden="true" className="h-px w-3 bg-white/25" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={POSITION_ICON_SRC[position]} alt="" className="h-6 w-6 opacity-85 brightness-0 invert drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
  );
}

function PlayerRatingRow({
  left,
  right,
  players,
  champions,
  ratingsForPlayer,
  leftIsWinner,
  rightIsWinner,
}: {
  left?: { playerId: string; championId?: string | null; position: PlayerPosition };
  right?: { playerId: string; championId?: string | null; position: PlayerPosition };
  players: Player[];
  champions: Champion[];
  ratingsForPlayer: (playerId: string) => FanRating[];
  leftIsWinner: boolean;
  rightIsWinner: boolean;
}) {
  const leftPlayer = players.find((player) => player.id === left?.playerId);
  const rightPlayer = players.find((player) => player.id === right?.playerId);
  const leftChampion = champions.find((champion) => champion.id === left?.championId);
  const rightChampion = champions.find((champion) => champion.id === right?.championId);
  const leftAverage = left ? averageRating(ratingsForPlayer(left.playerId)) : null;
  const rightAverage = right ? averageRating(ratingsForPlayer(right.playerId)) : null;

  return (
    <div className="grid h-[64px] grid-cols-[minmax(0,1fr)_auto_26px_auto_minmax(0,1fr)] items-center gap-1.5 px-2">
      <div className="flex min-w-0 items-center gap-2">
        <PlayerMark player={leftPlayer} champion={leftChampion} />
        <span className="whitespace-nowrap text-[15px] font-bold text-white">{leftPlayer?.name ?? "-"}</span>
      </div>
      <RatingPill value={leftAverage} opponentValue={rightAverage} isWinner={leftIsWinner} />
      <span className="grid place-items-center">
        <PositionIcon position={left?.position ?? right?.position} />
      </span>
      <RatingPill value={rightAverage} opponentValue={leftAverage} isWinner={rightIsWinner} />
      <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
        <PlayerMark player={rightPlayer} champion={rightChampion} />
        <span className="whitespace-nowrap text-[15px] font-bold text-white">{rightPlayer?.name ?? "-"}</span>
      </div>
    </div>
  );
}

export default async function SetRatingSnapshotPage({ params }: { params: Promise<{ matchId: string; setId: string }> }) {
  const { matchId, setId } = await params;
  const [match, set] = await Promise.all([getMatchById(matchId), getSetById(setId)]);

  if (!match || !set || set.matchId !== match.id) notFound();

  const [teams, players, statLines, fanRatings, tournaments, champions] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getPlayerStatLines(set.id),
    getFanRatingsByMatchId(match.id),
    getTournaments(),
    getChampions(),
  ]);

  const teamA = teams.find((team) => team.id === set.blueTeamId);
  const teamB = teams.find((team) => team.id === set.redTeamId);
  const tournamentName = tournaments.find((item) => item.id === match.tournamentId)?.name;
  const shellClass = "layout-capture flex flex-col gap-4 py-8";

  if (!isSetRatingSnapshotReady(set)) {
    return (
      <main className={shellClass}>
        <section className="rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center">
          <p className="text-base font-bold">아직 공유 이미지를 준비하고 있어요.</p>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">경기 종료 20분 후부터 팬 평점 이미지를 만들 수 있습니다.</p>
          <Link href={setHref(match, set)} className="mt-5 inline-flex rounded-lg bg-[var(--ui-ink)] px-4 py-2.5 text-sm font-bold text-[var(--ui-surface)]">세트 상세로 돌아가기</Link>
        </section>
      </main>
    );
  }

  const orderLines = (teamId: string) => statLines
    .filter((line) => line.teamId === teamId)
    .sort((a, b) => (POSITION_ORDER.get(a.position) ?? 99) - (POSITION_ORDER.get(b.position) ?? 99));
  const blueLines = orderLines(set.blueTeamId);
  const redLines = orderLines(set.redTeamId);
  const setRatings = fanRatings.filter((rating) => rating.setId === set.id);
  const ratingsForPlayer = (playerId: string) => setRatings.filter((rating) => rating.playerId === playerId);
  const blueIsWinner = set.winnerTeamId === set.blueTeamId
    || (set.winnerTeamId == null && (set.blueKills ?? 0) > (set.redKills ?? 0));
  const redIsWinner = !blueIsWinner;
  const backgroundImage = "/images/rating-snapshots/lck-championship-wings-v1.png";
  const filename = `${teamA?.shortName ?? "팀A"}-${teamB?.shortName ?? "팀B"}-${set.setNumber}세트-팬평점.png`;

  return (
    <main className={shellClass}>
      <div id="rating-share-card" className="relative isolate aspect-[4/5] w-full overflow-hidden bg-[#07111f] text-white shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 -z-30 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }} />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(4,11,23,0.44)_0%,rgba(4,10,20,0.7)_42%,rgba(5,11,20,0.88)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_25%,rgba(65,135,255,0.2),transparent_38%)]" />

        <div className="flex h-full flex-col px-5 pb-5 pt-5">
          <header className="flex items-start justify-between gap-4">
            <p className="text-[13px] font-medium text-white/55">{formatDateTime(match.matchDate)}</p>
            <p className="max-w-[220px] text-right text-[13px] font-medium leading-5 text-white/60">{tournamentName ?? match.name}</p>
          </header>

          <section className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <SnapshotTeamBlock team={teamA} winner={blueIsWinner} />
            <div>
              <p className="text-[13px] font-medium text-white/45">{set.setNumber}세트 · 킬 스코어</p>
              <p className="mt-0.5 text-[28px] font-black tabular-nums">
                <ScoreValue value={set.blueKills} winner={blueIsWinner} />
                <span className="mx-2 text-white/25">:</span>
                <ScoreValue value={set.redKills} winner={redIsWinner} />
              </p>
            </div>
            <SnapshotTeamBlock team={teamB} winner={redIsWinner} />
          </section>

          <section className="mt-4 shrink-0 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 py-3 text-[13px] font-medium text-white/45">
              <span>{teamA?.name ?? "블루 팀"}</span>
              <span>선수별 평균</span>
              <span className="text-right">{teamB?.name ?? "레드 팀"}</span>
            </div>
            {Array.from({ length: Math.max(blueLines.length, redLines.length, 5) }, (_, index) => (
              <PlayerRatingRow
                key={index}
                left={blueLines[index]}
                right={redLines[index]}
                players={players}
                champions={champions}
                ratingsForPlayer={ratingsForPlayer}
                leftIsWinner={blueIsWinner}
                rightIsWinner={redIsWinner}
              />
            ))}
          </section>

          <footer className="mt-auto flex justify-end pt-4">
            <p className="text-base font-black tracking-tight text-white">minion.fan</p>
          </footer>
        </div>
      </div>

      <SnapshotActions filename={filename} />
    </main>
  );
}
