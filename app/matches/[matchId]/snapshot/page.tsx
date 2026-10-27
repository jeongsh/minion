import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getAllPlayers,
  getAllTeams,
  getFanRatingsByMatchId,
  getMatchById,
  getPlayerStatLines,
  getSetsByMatchId,
  getTournaments,
} from "@/lib/data/lck";
import { formatFanRating } from "@/lib/fan-rating-display";
import type { PlayerPosition, Team } from "@/lib/types";
import { formatDateTime } from "@/lib/view-data";

import { SnapshotActions } from "../sets/[setId]/snapshot/snapshot-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "경기 평가 스냅샷", robots: { index: false } };

const POSITIONS: PlayerPosition[] = ["TOP", "JGL", "MID", "BOT", "SUP"];
const POSITION_ICON_SRC: Record<PlayerPosition, string> = {
  TOP: "/objectives/position-top.svg",
  JGL: "/objectives/position-jungle.svg",
  MID: "/objectives/position-middle.svg",
  BOT: "/objectives/position-bottom.svg",
  SUP: "/objectives/position-utility.svg",
};

function TeamLogo({ team }: { team?: Team }) {
  const logo = team?.logoWhiteUrl || team?.logoUrl;
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="h-14 w-14 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]" />;
  }
  return <span className="grid h-14 w-14 place-items-center rounded-full border border-white/25 text-[13px] font-medium text-white/60">팀</span>;
}

function TeamBlock({ team, winner }: { team?: Team; winner: boolean }) {
  return <div className={`flex flex-col items-center ${winner ? "opacity-100" : "opacity-55"}`}><div className={winner ? "" : "grayscale"}><TeamLogo team={team} /></div><strong className={`text-base font-black ${winner ? "text-white" : "text-white/60"}`}>{team?.shortName ?? "미정"}</strong></div>;
}

function RatingPill({ value, opponentValue, isWinner }: { value: number | null; opponentValue: number | null; isWinner: boolean }) {
  const hasComparableRatings = value != null && opponentValue != null && value !== opponentValue;
  const isHigher = hasComparableRatings ? value > opponentValue : isWinner;
  const tone = isHigher ? "bg-[#ed3150]" : "bg-[#2968e8]";
  return <strong className={`min-w-[46px] rounded-md px-2 py-1 text-center text-[17px] font-bold tabular-nums text-white shadow-lg ${tone}`}>{formatFanRating(value)}</strong>;
}

function PositionIcon({ position }: { position: PlayerPosition }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={POSITION_ICON_SRC[position]} alt="" className="h-6 w-6 opacity-85 brightness-0 invert drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />;
}

export default async function MatchRatingSnapshotPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const [match, sets] = await Promise.all([getMatchById(matchId), getSetsByMatchId(matchId)]);
  if (!match || sets.length === 0) notFound();

  const [teams, players, ratings, tournaments, statLineGroups] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getFanRatingsByMatchId(match.id),
    getTournaments(),
    Promise.all(sets.map((set) => getPlayerStatLines(set.id))),
  ]);
  const blueTeamId = match.teamAId;
  const redTeamId = match.teamBId;
  const blueTeam = teams.find((team) => team.id === blueTeamId);
  const redTeam = teams.find((team) => team.id === redTeamId);
  const tournamentName = tournaments.find((item) => item.id === match.tournamentId)?.name;
  const blueScore = sets.filter((set) => set.winnerTeamId === blueTeamId).length;
  const redScore = sets.filter((set) => set.winnerTeamId === redTeamId).length;
  const rosterLines = [...statLineGroups].reverse().find((group) => group.length > 0) ?? [];
  const ratingRows = POSITIONS.map((position) => ({
    position,
    left: rosterLines.find((line) => line.teamId === blueTeamId && line.position === position),
    right: rosterLines.find((line) => line.teamId === redTeamId && line.position === position),
  }));
  const avgFor = (playerId: string) => {
    const ratingsBySet = new Map<string, number[]>();
    for (const rating of ratings) {
      if (rating.playerId !== playerId) continue;
      const setRatings = ratingsBySet.get(rating.setId) ?? [];
      setRatings.push(rating.rating);
      ratingsBySet.set(rating.setId, setRatings);
    }
    const setAverages = [...ratingsBySet.values()].map((setRatings) =>
      setRatings.reduce((sum, rating) => sum + rating, 0) / setRatings.length,
    );
    return setAverages.length
      ? setAverages.reduce((sum, rating) => sum + rating, 0) / setAverages.length
      : null;
  };
  const filename = `${blueTeam?.shortName ?? "팀A"}-${redTeam?.shortName ?? "팀B"}-경기-팬평점.png`;
  const shellClass = "layout-capture flex flex-col gap-4 py-8";

  return <main className={shellClass}>
    <div id="rating-share-card" className="relative isolate aspect-[4/5] w-full overflow-hidden bg-[#07111f] text-white shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <div className="absolute inset-0 -z-30 bg-cover bg-center" style={{ backgroundImage: "url(/images/rating-snapshots/lck-championship-wings-v1.png)" }} />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(4,11,23,0.44)_0%,rgba(4,10,20,0.7)_42%,rgba(5,11,20,0.88)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_25%,rgba(65,135,255,0.2),transparent_38%)]" />
      <div className="flex h-full flex-col px-4 pb-4 pt-4">
        <header className="flex items-start justify-between gap-4"><p className="text-[13px] font-medium text-white/55">{formatDateTime(match.matchDate)}</p><p className="max-w-[220px] text-right text-[13px] font-medium leading-5 text-white/60">{tournamentName ?? match.name}</p></header>
        <section className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><TeamBlock team={blueTeam} winner={blueScore > redScore} /><div><p className="text-[13px] font-medium text-white/45">세트 스코어</p><p className="mt-0.5 text-[28px] font-black tabular-nums"><span className={blueScore >= redScore ? "text-white" : "text-white/38"}>{blueScore}</span><span className="mx-2 text-white/25">:</span><span className={redScore >= blueScore ? "text-white" : "text-white/38"}>{redScore}</span></p></div><TeamBlock team={redTeam} winner={redScore > blueScore} /></section>
        <section className="mt-2 shrink-0 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 py-3 text-[13px] font-medium text-white/45"><span>{blueTeam?.name ?? "블루 팀"}</span><span className="whitespace-nowrap">세트 평균</span><span className="text-right">{redTeam?.name ?? "레드 팀"}</span></div>
          {ratingRows.map(({ position, left, right }) => {
            const leftPlayer = left ? players.find((item) => item.id === left.playerId) : undefined;
            const rightPlayer = right ? players.find((item) => item.id === right.playerId) : undefined;
            const leftValue = left ? avgFor(left.playerId) : null;
            const rightValue = right ? avgFor(right.playerId) : null;
            return <div key={position} className="grid h-[64px] grid-cols-[minmax(0,1fr)_auto_26px_auto_minmax(0,1fr)] items-center gap-1.5 px-2">
              <span className="whitespace-nowrap text-[15px] font-bold text-white">{leftPlayer?.name ?? "-"}</span>
              <RatingPill value={leftValue} opponentValue={rightValue} isWinner={blueScore > redScore} />
              <span className="grid place-items-center"><PositionIcon position={position} /></span>
              <RatingPill value={rightValue} opponentValue={leftValue} isWinner={redScore > blueScore} />
              <span className="whitespace-nowrap text-right text-[15px] font-bold text-white">{rightPlayer?.name ?? "-"}</span>
            </div>;
          })}
        </section>
        <footer className="mt-auto flex justify-end pt-4"><p className="text-base font-black tracking-tight text-white">minion.fan</p></footer>
      </div>
    </div>
    <SnapshotActions filename={filename} imageWidth={1080} imageHeight={1350} />
  </main>;
}
