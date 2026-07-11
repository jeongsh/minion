import { getIsFan } from "@/app/fan/[teamSlug]/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { FanFollowButton } from "@/components/fan/fan-follow-button";
import { FanPredictionCard } from "@/components/fan/fan-prediction-card";
// import { FanTemperatureCard } from "@/components/fan/fan-temperature-card";
import { getAllTeams, getMatches, getTeamByFanSiteHost, getTeamBySlug, getTeamFanCount } from "@/lib/data/lck";
import type { FanTemperatureSnapshot } from "@/lib/data/fan-pulse";
import { getPredictionMarketData } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";

function dateKey(value: string | Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof value === "string" ? new Date(value) : value); }
function dday(value: string) { const diff = Math.round((Date.parse(dateKey(value)) - Date.parse(dateKey(new Date()))) / 86400000); return diff <= 0 ? "D-DAY" : `D-${diff}`; }
function dateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function tickerDateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function opponentOf(match: Match, team: Team, teams: Team[]) { return teams.find((item) => item.id === (match.teamAId === team.id ? match.teamBId : match.teamAId)); }
function resultOf(match: Match, team: Team) {
  const isTeamA = match.teamAId === team.id;
  const ownScore = isTeamA ? match.teamAScore : match.teamBScore;
  const opponentScore = isTeamA ? match.teamBScore : match.teamAScore;
  if (ownScore == null || opponentScore == null) return "결과 확인 중";
  return `${ownScore > opponentScore ? "승" : "패"} ${ownScore}:${opponentScore}`;
}

export async function FanChannelHeader({ teamSlug }: { teamSlug: string; fanTemperature: FanTemperatureSnapshot }) {
  const [team, teams, matches] = await Promise.all([getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug)), getAllTeams(), getMatches()]);
  if (!team) return null;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const ownMatches = matches.filter((match) => match.teamAId === team.id || match.teamBId === team.id);
  const live = ownMatches.find((match) => match.status === "live");
  const upcomingMatches = ownMatches.filter((match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now).sort((a,b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const recentMatches = ownMatches.filter((match) => match.status === "completed" || new Date(match.matchDate).getTime() < now).sort((a,b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const upcoming = upcomingMatches[0];
  const recent = recentMatches[0];
  const match = live ?? upcoming ?? recent;
  const mode = live ? "live" : upcoming ? "upcoming" : recent ? "recent" : "empty";
  const opponent = match ? opponentOf(match, team, teams) : undefined;
  const user = await getCurrentUser();
  const [fanCount, isFan, predictionMarket] = await Promise.all([getTeamFanCount(team.id), getIsFan(team.id), getPredictionMarketData(user?.id)]);
  const opponentName = opponent?.shortName ?? "TBD";
  const badge = mode === "live" ? "LIVE" : mode === "upcoming" && match ? dday(match.matchDate) : mode === "recent" ? "경기 종료" : "일정 없음";
  const links = [["홈페이지",team.officialHomepageUrl],["YouTube",team.officialYoutubeUrl],["X",team.officialXUrl],["Instagram",team.officialInstagramUrl]].filter((item): item is [string,string] => Boolean(item[1]));
  const tickerItems = [
    ...(live ? [`LIVE · ${team.shortName} VS ${opponentOf(live, team, teams)?.shortName ?? "TBD"} · ${live.name?.trim() || "경기 진행 중"}`] : []),
    ...upcomingMatches.slice(0, 4).map((item, index) => {
      const opponent = opponentOf(item, team, teams)?.shortName ?? "TBD";
      const context = item.name?.trim() || item.venue?.trim();
      return `NEXT ${index + 1} · ${tickerDateTime(item.matchDate)} · ${team.shortName} VS ${opponent}${context ? ` · ${context}` : ""}`;
    }),
    ...recentMatches.slice(0, 2).map((item) => `RECENT · ${team.shortName} ${resultOf(item, team)} ${opponentOf(item, team, teams)?.shortName ?? "TBD"} · ${tickerDateTime(item.matchDate)}`),
  ];
  if (!tickerItems.length) tickerItems.push(`${team.shortName} · 등록된 경기 일정이 없습니다`);
  return (
    <header className="relative overflow-hidden bg-[var(--team-primary)] text-[var(--team-on-primary)]">
      <div className="relative mx-auto max-w-[1400px] px-5"><span aria-hidden className="pointer-events-none absolute -right-2 -top-16 text-[250px] font-black leading-none text-white/[0.07]">{team.shortName}</span>
        <div className="relative grid items-center gap-11 pb-10 pt-11 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-3"><span className="rounded bg-[var(--team-on-primary)] px-[10px] py-1 text-[13px] font-black text-[var(--team-primary)]">{badge}</span><span className="text-xs font-extrabold tracking-[0.12em] opacity-80">{match?.name?.trim() || "다가올 경기를 기다리는 중"}</span></div>
            <div className="flex items-baseline gap-5"><span className="text-[clamp(58px,7vw,96px)] font-black leading-[0.92] tracking-[-0.04em]">{team.shortName}</span><span className="text-[30px] font-black text-white/55">VS</span><span className="text-[clamp(58px,7vw,96px)] font-black leading-[0.92] tracking-[-0.04em] text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,0.85)]">{opponentName}</span></div>
            <p className="text-[15px] font-bold opacity-85">{match ? `${dateTime(match.matchDate)} · ${match.venue?.trim() || "LoL PARK"}` : "예정된 경기가 없습니다"}</p>
            <div className="flex flex-wrap items-center gap-2"><FanFollowButton teamId={team.id} teamSlug={team.fanSiteHost} teamName={team.shortName} initialCount={fanCount} initialFollowing={isFan} teamColor={team.primaryColor}/><button type="button" className="rounded-full border border-white/50 px-5 py-2.5 text-sm font-extrabold transition hover:bg-white/10">알람</button>{links.map(([label,href])=><a key={label} href={href} target="_blank" rel="noreferrer" className="rounded-full border border-white/35 px-4 py-2.5 text-xs font-bold text-white/85 hover:bg-white/10 hover:text-white">{label}</a>)}</div>
          </div>
          <FanPredictionCard showDetailsLink={false} matchId={match?.id} teamId={team.id} teamName={team.shortName} opponentId={opponent?.id} opponentName={opponentName} teamColor={team.primaryColor} bets={predictionMarket.bets} currentUserId={user?.id} balance={predictionMarket.balance} canVote={mode==="upcoming"}/>
        </div>
        {/* 팬 반응 임시 비노출
        <FanTemperatureCard
          variant="header"
          teamId={team.id}
          teamSlug={team.fanSiteHost}
          teamName={team.shortName}
          teamColor={team.primaryColor}
          initialSnapshot={fanTemperature}
        />
        */}
      </div>
      <div className="overflow-hidden bg-black/20 py-[9px]"><div className="fan-ticker-track text-xs font-extrabold tracking-[0.08em] text-white/85">{[false,true].map((hidden)=><div key={String(hidden)} className="fan-ticker-group" aria-hidden={hidden||undefined}>{tickerItems.map((item)=><span key={item} className="px-5">{item}<span className="ml-10 text-white/45">•</span></span>)}</div>)}</div></div>
    </header>
  );
}
