import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight } from "lucide-react";

import type { FeedInstaItem, FeedVideoItem } from "@/components/fan/fan-feed-mosaic";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { FanChannelHeader } from "@/components/fan/fan-channel-header";
import { FanHeaderTooltip, fanHeaderIconButtonClass } from "@/components/fan/fan-header-control-styles";
import { FanHomeVideoSwiper } from "@/components/fan/fan-home-video-swiper";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import { FanSocialPreview } from "@/components/fan/fan-social-preview";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { AdSlot } from "@/components/ui/ad-slot";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  getAllTeams,
  getFanVideoFeed,
  getMatches,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTeamInstagramFeed,
} from "@/lib/data/lck";
import { getBoardPosts } from "@/lib/data/community";
import { compareHotPostsByRecentHype, isHotPost } from "@/lib/community/hot";
import { buildFanVideoItems } from "@/lib/fan-video-items";
import { getCalendarEvents, getTodayCelebrations } from "@/lib/calendar/events";
import { shouldUseWhiteLogoOnDark } from "@/lib/team-logos";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { Match, Player, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

const POSITION_ORDER: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

function formatMatchDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function byMatchDate(a: Match, b: Match) {
  return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
}

function yearMonthKeyKST(value: string) {
  return dateKeyKST(value).slice(0, 7);
}

function teamForMatch(match: Match, team: Team, teams: Team[]) {
  const opponentId = match.teamAId === team.id ? match.teamBId : match.teamAId;
  return teams.find((item) => item.id === opponentId);
}

function teamResult(match: Match, team: Team): "W" | "L" | null {
  if (match.status !== "completed") return null;
  if (match.winnerTeamId) return match.winnerTeamId === team.id ? "W" : "L";
  const isA = match.teamAId === team.id;
  const own = isA ? match.teamAScore : match.teamBScore;
  const opp = isA ? match.teamBScore : match.teamAScore;
  if (own == null || opp == null) return null;
  return own > opp ? "W" : "L";
}

function scoreLabel(match: Match, team: Team): string {
  if (match.teamAScore == null || match.teamBScore == null) return "0 : 0";
  const isA = match.teamAId === team.id;
  const own = isA ? match.teamAScore : match.teamBScore;
  const opp = isA ? match.teamBScore : match.teamAScore;
  return `${own} : ${opp}`;
}

// ─── 섹션: 매치 행 (일정 페이지 매치 로우 언어를 팬 홈용으로 압축) ──

function MatchRow({ match, team, teams }: { match: Match; team: Team; teams: Team[] }) {
  const opponent = teamForMatch(match, team, teams);
  const result = teamResult(match, team);
  const scheduled = match.status !== "completed";
  const badgeText = scheduled ? "예정" : result ?? "-";
  const score = scheduled ? null : scoreLabel(match, team);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex h-14 items-center gap-2.5 px-3 transition-colors hover:bg-[var(--ui-card-hover)] sm:h-[68px] sm:gap-3 sm:px-4 md:px-5 lg:h-[72px]"
    >
      <span
        className={`grid h-8 w-10 shrink-0 place-items-center rounded-md text-[12px] font-medium tabular-nums sm:h-9 sm:w-11 sm:text-[13px] ${
          scheduled ? "bg-[var(--ui-surface)] text-[var(--ui-ink)]" : "text-white"
        }`}
        style={scheduled ? undefined : { background: result === "W" ? "var(--tp)" : "var(--ui-muted)" }}
      >
        {badgeText}
      </span>
      <TeamLogo team={opponent} size="h-8 w-8 sm:h-10 sm:w-10" themeAware />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-1.5 text-[14px] font-extrabold text-[var(--ui-ink)] sm:gap-2 sm:text-[15px]">
          <span className="truncate">{opponent?.shortName ?? "TBD"}</span>
          {score ? <span className="shrink-0 tabular-nums text-[var(--ui-text)]">{score}</span> : null}
        </span>
        <span className="truncate text-[12px] font-medium text-[var(--ui-muted)] sm:text-[13px]">
          {formatMatchDay(match.matchDate)}
          {match.name?.trim() ? ` · ${match.name.trim()}` : ""}
        </span>
      </div>
      <span
        className="flex shrink-0 items-center gap-0.5 text-[12px] font-medium"
        style={scheduled ? { color: "var(--tp)" } : undefined}
      >
        <span className={`${scheduled ? "" : "text-[var(--ui-muted)]"} hidden sm:inline`}>{scheduled ? "승부예측" : "매치 데이터"}</span>
        <ChevronRight size={14} className={scheduled ? "" : "text-[var(--ui-muted)]"} />
      </span>
    </Link>
  );
}

// ─── 섹션: 로스터 ───────────────────────────────────────────────

function Roster({ players, teamSlug }: { players: Player[]; teamSlug: string }) {
  return (
    <div>
      <SectionHeading href={`/fan/${teamSlug}/players`}>선수단</SectionHeading>
      <div className="grid auto-cols-[106px] grid-flow-col gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {players.slice(0, 5).map((player) => (
          <Link
            key={player.id}
            href={`/fan/${teamSlug}/players/${player.slug}`}
            className="fan-roster-chip group flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 text-center transition sm:min-h-[88px] sm:flex-row sm:justify-start sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-left"
          >
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--ui-surface)] sm:h-14 sm:w-14">
              {player.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.profileImageUrl}
                  alt={player.name}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <span className="grid h-full place-items-center text-[12px] font-medium text-[var(--ui-muted)] sm:text-[13px]">
                  {player.name.slice(0, 2)}
                </span>
              )}
            </span>
            <div className="flex min-w-0 max-w-full flex-col gap-[1px]">
              <span className="truncate text-[13px] font-extrabold text-[var(--ui-ink)] sm:text-[15px]">{player.name}</span>
              <span className="whitespace-nowrap text-[11px] font-medium sm:text-[13px]" style={{ color: "var(--tp)" }}>
                {player.position}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── 페이지 ─────────────────────────────────────────────────────

export default async function FanHomePage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  // fanSiteHost가 비어 있으면 진입에 사용한 slug로 폴백해 하위 링크가 /fan/undefined로 깨지지 않게 한다.
  const fanSlug = team.fanSiteHost ?? teamSlug;

  const [teams, players, matches, boardPosts, calendarEvents] = await Promise.all([
    getAllTeams(),
    getPlayers(),
    getMatches(),
    getBoardPosts({ scope: "team", teamId: team.id }),
    getCalendarEvents({ teamId: team.id }),
  ]);

  const todayCelebrations = getTodayCelebrations(calendarEvents);
  const calendarMonthKey = dateKeyKST(new Date()).slice(0, 7);

  const teamPlayers = players
    .filter((player) => player.teamId === team.id)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
  const playerIds = teamPlayers.map((p) => p.id);

  const [instagramFeed, videoFeed] = await Promise.all([
    getTeamInstagramFeed(team.id, playerIds),
    getFanVideoFeed(team.id, playerIds),
  ]);

  const teamMatches = matches
    .filter((match) => match.teamAId === team.id || match.teamBId === team.id)
    .sort(byMatchDate);
  const teamsById = new Map(teams.map((item) => [item.id, item]));
  const calendarMatches = teamMatches.filter((match) => yearMonthKeyKST(match.matchDate) === calendarMonthKey);
  const calendarClientMatches: HomeCalendarMatch[] = calendarMatches.map((match) => {
    const teamA = teamsById.get(match.teamAId);
    const teamB = teamsById.get(match.teamBId);

    return {
      id: match.id,
      dateKey: dateKeyKST(match.matchDate),
      href: matchHref(match),
      time: formatTimeKST(match.matchDate),
      league: "",
      teamAName: teamA?.shortName ?? "TBD",
      teamBName: teamB?.shortName ?? "TBD",
      teamALogoUrl: teamA?.logoUrl ?? null,
      teamBLogoUrl: teamB?.logoUrl ?? null,
      teamALogoDarkUrl: shouldUseWhiteLogoOnDark(teamA) ? teamA?.logoWhiteUrl : null,
      teamBLogoDarkUrl: shouldUseWhiteLogoOnDark(teamB) ? teamB?.logoWhiteUrl : null,
    };
  });

  // 이 페이지는 force-dynamic이라 요청 시각으로 지난 예정 경기를 걸러낸다.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcomingMatches = teamMatches.filter(
    (match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now,
  );
  const completedMatches = [...teamMatches]
    .filter((match) => match.status === "completed" || new Date(match.matchDate).getTime() < now)
    .reverse();

  // MATCHES 미니 리스트: 예정 3 + 결과 2
  const matchRows = [...upcomingMatches.slice(0, 3), ...completedMatches.slice(0, 2)];
  // FEED 데이터 준비 — 영상은 상세 페이지 라우팅용 routeId를 포함해 만든다.
  const playersById = new Map(teamPlayers.map((player) => [player.id, player]));
  const feedVideos: FeedVideoItem[] = buildFanVideoItems({
    team,
    players: teamPlayers,
    teamVideos: videoFeed.teamVideos,
    playerVideos: videoFeed.playerVideos,
  });
  const feedInsta: FeedInstaItem[] = [
    ...instagramFeed.teamPosts.map((p) => ({
      id: `team-${p.id}`,
      ownerName: team.shortName,
      caption: p.content || p.title,
      imageUrl: p.thumbnailUrl,
      sourceUrl: p.sourceUrl,
      postedAt: p.publishedAt,
    })),
    ...instagramFeed.playerPosts.map((p) => ({
      id: `player-${p.id}`,
      ownerName: playersById.get(p.playerId)?.name ?? "선수",
      caption: p.caption,
      imageUrl: p.imageUrl,
      sourceUrl: p.sourceUrl,
      postedAt: p.postedAt,
      likesCount: p.likesCount,
    })),
  ].sort((a, b) => (b.postedAt ? new Date(b.postedAt).getTime() : 0) - (a.postedAt ? new Date(a.postedAt).getTime() : 0));
  const rankedHotBoardPosts = boardPosts
    .filter((post) => !post.blindedAt && !post.isNotice && isHotPost(post))
    .sort(compareHotPostsByRecentHype)
    .slice(0, 12);

  return (
    <>
      <FanChannelHeader
        teamSlug={teamSlug}
        calendarSlot={
          <AdaptiveDialog
            title={`${team.shortName} 캘린더`}
            trigger={
              <>
                <CalendarDays size={16} aria-hidden="true" />
                <FanHeaderTooltip>캘린더</FanHeaderTooltip>
              </>
            }
            triggerClassName={fanHeaderIconButtonClass}
            triggerAriaLabel="캘린더"
            panelClassName="sm:max-w-[380px]"
          >
            <HomeCalendar initialMonthKey={calendarMonthKey} matches={calendarClientMatches} events={calendarEvents} />
          </AdaptiveDialog>
        }
      />
      <FanPageShell contentClassName="">
      <div
        className="fan-home-page flex flex-col gap-5 text-[var(--ui-ink)] md:gap-8"
        style={{ "--tp": team.primaryColor } as React.CSSProperties}
      >
        {/* 오늘의 기념일 배너 → 팀 게시판으로 이동 */}
        {todayCelebrations.length > 0 ? (
          <CelebrationBanner events={todayCelebrations} />
        ) : null}

        {/* 모바일에서는 다음 경기 한 건을 콘텐츠 문맥 안에서 바로 보여준다. */}
        <section className="lg:hidden">
          <SectionHeading href={`/fan/${fanSlug}/matches`}>다음 경기</SectionHeading>
          <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            {matchRows[0] ? <MatchRow match={matchRows[0]} team={team} teams={teams} /> : <p className="px-5 py-10 text-center text-sm text-[var(--ui-muted)]">등록된 경기가 없습니다.</p>}
          </div>
        </section>

        {/* 게시판이 첫 줄을 전체폭으로 채운다.
            경기 일정은 헤더 히어로(다음 경기)·티커(NEXT 1~4)·일정 탭이 이미 세 번 다루므로
            여기서 네 번째로 반복하지 않는다. */}
        <section>
          <SectionHeading href={`/fan/${fanSlug}/community`}>인기글</SectionHeading>
          <HomeBoardCarousel
            posts={rankedHotBoardPosts}
            scope="team"
            teamSlug={fanSlug}
          />
        </section>

        {/* 소셜 피드 */}
        <section>
          <SectionHeading href={`/fan/${fanSlug}/instagram`}>소셜 피드</SectionHeading>
          <FanSocialPreview items={feedInsta} />
        </section>

        {/* 최신 영상 */}
        <section>
          <SectionHeading href={`/fan/${fanSlug}/videos`}>최신 영상</SectionHeading>
          <FanHomeVideoSwiper teamSlug={fanSlug} videos={feedVideos} />
        </section>

        {/* 선수단 — 자주 바뀌지 않는 정보라 첫 화면 대신 아래쪽에 둔다. */}
        <section>
          <Roster players={teamPlayers} teamSlug={fanSlug} />
        </section>

        <AdSlot placement="horizontal" className="hidden h-[60px] md:block xl:h-[90px]" />

      </div>
      </FanPageShell>
    </>
  );
}
