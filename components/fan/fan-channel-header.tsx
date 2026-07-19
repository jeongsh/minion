import { CheckCircle2 } from "lucide-react";

import { getFanNotificationEnabled, getIsFan } from "@/app/fan/[teamSlug]/actions";
import { FanAlarmButton } from "@/components/fan/fan-alarm-button";
import { FanFollowButton } from "@/components/fan/fan-follow-button";
import { FanPredictionCard } from "@/components/fan/fan-prediction-card";
import { FanTicker } from "@/components/fan/fan-ticker";
import { TeamLogo } from "@/components/ui/team-logo";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getAllTeams,
  getMatches,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTeamFanCount,
} from "@/lib/data/lck";
import { isMatchLive } from "@/lib/match-display";
import { getPredictionMarketData } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";

function dateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function dday(value: string) {
  const diff = Math.round((Date.parse(dateKey(value)) - Date.parse(dateKey(new Date()))) / 86400000);
  return diff <= 0 ? "D-DAY" : `D-${diff}`;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function tickerDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function opponentOf(match: Match, team: Team, teams: Team[]) {
  return teams.find((item) => item.id === (match.teamAId === team.id ? match.teamBId : match.teamAId));
}

function resultOf(match: Match, team: Team) {
  const isTeamA = match.teamAId === team.id;
  const ownScore = isTeamA ? match.teamAScore : match.teamBScore;
  const opponentScore = isTeamA ? match.teamBScore : match.teamAScore;
  if (ownScore == null || opponentScore == null) return "결과 확인 중";
  return `${ownScore > opponentScore ? "승" : "패"} ${ownScore}:${opponentScore}`;
}


export async function FanChannelHeader({ teamSlug }: { teamSlug: string }) {
  const [team, teams, matches] = await Promise.all([
    getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug)),
    getAllTeams(),
    getMatches(),
  ]);

  if (!team) return null;

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const ownMatches = matches.filter((match) => match.teamAId === team.id || match.teamBId === team.id);
  // status留?蹂대㈃, 寃쎄린媛 ?대? ?쒖옉?덈뒗??status ?숆린?붽? ?꾩쭅 "scheduled"??癒몃Ъ??
  // ?덈뒗 寃쎄린媛 live濡쒕룄 ???≫엳怨?upcoming(?쒖옉?쒓컖 吏???먯꽌??鍮좎졇??recentMatches??
  // "matchDate < now" ?대갚??嫄몃젮 "寃쎄린 醫낅즺"濡??섎せ ?쒖떆?먮떎. isMatchLive濡??듭씪?댁꽌
  // ?섎㉧吏 ?붾㈃(schedule-list.tsx ??怨?媛숈? 湲곗????대떎.
  const live = ownMatches.find((match) => isMatchLive(match, now));
  const upcomingMatches = ownMatches
    .filter((match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const recentMatches = ownMatches
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());

  const upcoming = upcomingMatches[0];
  const recent = recentMatches[0];
  const match = live ?? upcoming ?? recent;
  const mode = live ? "live" : upcoming ? "upcoming" : recent ? "recent" : "empty";
  const opponent = match ? opponentOf(match, team, teams) : undefined;
  const opponentName = opponent?.shortName ?? "TBD";
  const badge =
    mode === "live"
      ? "LIVE"
      : mode === "upcoming" && match
        ? dday(match.matchDate)
        : mode === "recent"
          ? "경기 종료"
          : "일정 없음";

  const user = await getCurrentUser();
  const [fanCount, isFan, notificationEnabled, predictionMarket] = await Promise.all([
    getTeamFanCount(team.id),
    getIsFan(team.id),
    user ? getFanNotificationEnabled(team.id) : Promise.resolve(false),
    getPredictionMarketData(user?.id),
  ]);

  const tickerItems = [
    ...(live
      ? [`LIVE · ${team.shortName} VS ${opponentOf(live, team, teams)?.shortName ?? "TBD"} · ${live.name?.trim() || "경기 진행 중"}`]
      : []),
    ...upcomingMatches.slice(0, 4).map((item, index) => {
      const nextOpponent = opponentOf(item, team, teams)?.shortName ?? "TBD";
      const context = item.name?.trim() || item.venue?.trim();
      return `NEXT ${index + 1} · ${tickerDateTime(item.matchDate)} · ${team.shortName} VS ${nextOpponent}${context ? ` · ${context}` : ""}`;
    }),
    ...recentMatches
      .slice(0, 2)
      .map(
        (item) =>
          `RECENT · ${team.shortName} ${resultOf(item, team)} ${opponentOf(item, team, teams)?.shortName ?? "TBD"} · ${tickerDateTime(item.matchDate)}`,
      ),
  ];

  if (!tickerItems.length) tickerItems.push(`${team.shortName} · 등록된 경기 일정이 없습니다`);

  return (
    <>
      <header className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] lg:hidden">
        <div className="layout-wide py-3.5 sm:py-5">
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] sm:h-20 sm:w-20">
              <TeamLogo team={team} size="h-[72%] w-[72%]" plain themeAware />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <h1 className="min-w-0 truncate text-[19px] font-extrabold leading-tight text-[var(--team-primary)] sm:text-[22px]">
                  {team.shortName}
                </h1>
                <CheckCircle2 size={16} className="shrink-0" style={{ color: team.primaryColor }} aria-hidden="true" />
              </div>
              <p className="mt-1 text-[13px] font-semibold text-[var(--ui-text)] sm:text-sm">
                팔로워 {fanCount.toLocaleString("ko-KR")}명
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-[1.45] text-[var(--ui-muted)] sm:text-sm">
                {team.name} 팬 채널입니다.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 sm:mt-4 sm:max-w-[340px]">
            <FanFollowButton
              teamId={team.id}
              teamSlug={team.fanSiteHost}
              teamName={team.shortName}
              initialCount={fanCount}
              initialFollowing={isFan}
              teamColor={team.primaryColor}
              variant="channel"
            />
            <FanAlarmButton teamId={team.id} teamSlug={team.fanSiteHost} initialEnabled={notificationEnabled} compact />
          </div>
        </div>
      </header>

      <header className="relative hidden overflow-hidden border-b border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] lg:block">
        <div className="fan-page-container relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -top-16 text-[250px] font-black leading-none text-[var(--ui-surface-muted)]"
          >
            {team.shortName}
          </span>
          <div className="relative grid items-center gap-11 pb-10 pt-11 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-[18px]">
              <div className="flex items-center gap-3">
                <span className="rounded border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-[10px] py-1 text-[13px] font-black text-[var(--ui-ink)]">
                  {badge}
                </span>
                <span className="text-[13px] font-extrabold tracking-[0.12em] text-[var(--ui-text)]">
                  {match?.name?.trim() || "다음 경기를 기다리는 중"}
                </span>
              </div>
              <div className="flex items-baseline gap-5">
                <span className="text-[clamp(58px,7vw,96px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--team-primary)]">
                  {team.shortName}
                </span>
                <span className="text-[28px] font-black text-[var(--ui-muted)]">VS</span>
                <span className="text-[clamp(58px,7vw,96px)] font-black leading-[0.92] tracking-[-0.04em] text-transparent [-webkit-text-stroke:2px_var(--ui-muted)]">
                  {opponentName}
                </span>
              </div>
              <p className="text-[15px] font-bold text-[var(--ui-text)]">
                {match ? `${dateTime(match.matchDate)} · ${match.venue?.trim() || "LoL PARK"}` : "예정된 경기가 없습니다"}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <FanFollowButton
                  teamId={team.id}
                  teamSlug={team.fanSiteHost}
                  teamName={team.shortName}
                  initialCount={fanCount}
                  initialFollowing={isFan}
                  teamColor={team.primaryColor}
                />
                <FanAlarmButton teamId={team.id} teamSlug={team.fanSiteHost} initialEnabled={notificationEnabled} />
              </div>
            </div>
            <FanPredictionCard
              showDetailsLink={false}
              matchId={match?.id}
              teamId={team.id}
              teamName={team.shortName}
              opponentId={opponent?.id}
              opponentName={opponentName}
              teamColor={team.primaryColor}
              bets={predictionMarket.bets}
              currentUserId={user?.id}
              balance={predictionMarket.balance}
              canVote={mode === "upcoming"}
            />
          </div>
        </div>
        <FanTicker items={tickerItems} />
      </header>
    </>
  );
}
