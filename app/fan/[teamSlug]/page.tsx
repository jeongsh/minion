import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, CalendarDays, ChevronRight, Globe2, Play } from "lucide-react";

import type { FeedInstaItem, FeedVideoItem } from "@/components/fan/fan-feed-mosaic";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { FanChannelHeader } from "@/components/fan/fan-channel-header";
import { FanHomeVideoSwiper } from "@/components/fan/fan-home-video-swiper";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import { FanSocialPreview } from "@/components/fan/fan-social-preview";
import { AdSlot } from "@/components/ui/ad-slot";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamLogo } from "@/components/ui/team-logo";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
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
import { buildFanVideoItems } from "@/lib/fan-video-items";
import { getCalendarEvents, getCelebrationMessages, getTodayCelebrations } from "@/lib/calendar/events";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { CelebrationBanner, type CelebrationBannerItem } from "@/components/domain/celebration-banner";
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

function OfficialLinks({ team }: { team: Team }) {
  const links = [
    { label: "홈페이지", href: team.officialHomepageUrl, icon: <Globe2 size={16} aria-hidden="true" /> },
    { label: "YouTube", href: team.officialYoutubeUrl, icon: <Play size={16} aria-hidden="true" /> },
    { label: "X", href: team.officialXUrl, icon: <span className="text-[13px] font-black leading-none" aria-hidden="true">X</span> },
    { label: "Instagram", href: team.officialInstagramUrl, icon: <AtSign size={16} aria-hidden="true" /> },
  ].flatMap((item) => (item.href ? [{ ...item, href: item.href }] : []));

  if (!links.length) return null;

  return (
    <section className="flex flex-wrap items-center justify-center gap-2 border-t border-[var(--ui-border)] pt-5">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={link.label}
          title={link.label}
          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
        >
          {link.icon}
        </a>
      ))}
    </section>
  );
}

// 실제 선수별 KDA 집계 소스가 이 화면엔 없어 id 기반으로 그럴듯한 목업 값을 만든다.
function mockKda(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (2.6 + (hash % 280) / 100).toFixed(1);
}

// ─── 섹션: 매치 행 (일정 페이지 매치 로우 언어를 팬 홈용으로 압축) ──

function MatchRow({ match, team, teams }: { match: Match; team: Team; teams: Team[] }) {
  const opponent = teamForMatch(match, team, teams);
  const result = teamResult(match, team);
  const scheduled = match.status !== "completed";
  const badgeText = scheduled ? "예정" : result ?? "-";
  const score = scheduled ? null : scoreLabel(match, team);

  return (
    <div className="flex h-14 items-center gap-2.5 px-3 sm:h-[68px] sm:gap-3 sm:px-4 md:px-5 lg:h-[72px]">
      <span
        className={`grid h-8 w-10 shrink-0 place-items-center rounded-md text-[12px] font-extrabold tabular-nums sm:h-9 sm:w-11 sm:text-[13px] ${
          scheduled ? "bg-[var(--ui-surface)] text-[var(--ui-ink)]" : "text-white"
        }`}
        style={scheduled ? undefined : { background: result === "W" ? "var(--tp)" : "var(--ui-muted)" }}
      >
        {badgeText}
      </span>
      <TeamLogo team={opponent} size="h-8 w-8 sm:h-10 sm:w-10" />
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
      <Link
        href={`/matches/${match.id}`}
        className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold"
        style={scheduled ? { color: "var(--tp)" } : undefined}
      >
        <span className={`${scheduled ? "" : "text-[var(--ui-muted)]"} hidden sm:inline`}>{scheduled ? "승부예측" : "매치 데이터"}</span>
        <ChevronRight size={14} className={scheduled ? "" : "text-[var(--ui-muted)]"} />
      </Link>
    </div>
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
            className="fan-roster-chip group flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 text-center transition hover:bg-[var(--ui-surface-muted)] sm:min-h-[88px] sm:flex-row sm:justify-start sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-left"
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
              <span className="whitespace-nowrap text-[11px] font-bold sm:text-[13px]" style={{ color: "var(--tp)" }}>
                {player.position}{" "}
                <span className="font-bold text-[var(--ui-muted)]">· KDA {mockKda(player.id)}</span>
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

  const [teams, players, matches, boardPosts, calendarEvents, user] = await Promise.all([
    getAllTeams(),
    getPlayers(),
    getMatches(),
    getBoardPosts({ scope: "team", teamId: team.id }),
    getCalendarEvents({ teamId: team.id }),
    getCurrentUser(),
  ]);

  const todayCelebrations = getTodayCelebrations(calendarEvents);
  const celebrationItems: CelebrationBannerItem[] = await Promise.all(
    todayCelebrations.map(async (event) => ({
      event,
      messages: await getCelebrationMessages(event.key),
    })),
  );
  const calendarMonthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);

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

  const teamsById = new Map(teams.map((t) => [t.id, t]));
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

  return (
    <>
      <FanChannelHeader teamSlug={teamSlug} />
      <FanPageShell contentClassName="">
      <div
        className="fan-home-page flex flex-col gap-5 text-[var(--ui-ink)] md:gap-8"
        style={{ "--tp": team.primaryColor } as React.CSSProperties}
      >
        {/* 오늘의 기념일 배너 */}
        {celebrationItems.length > 0 ? (
          <CelebrationBanner items={celebrationItems} isLoggedIn={Boolean(user)} />
        ) : null}

        {/* 모바일은 다음 경기 한 건만 노출하고 캘린더는 필요할 때 연다. */}
        <section className="lg:hidden">
          <div className="flex items-center justify-between">
            <SectionHeading href={`/fan/${team.fanSiteHost}/matches`}>다음 경기</SectionHeading>
            <AdaptiveDialog title={`${team.shortName} 캘린더`} trigger={<span className="flex items-center gap-1.5"><CalendarDays size={16} />캘린더</span>} triggerClassName="mb-2 flex min-h-9 items-center rounded-lg border border-[var(--ui-border)] px-3 text-[12px] font-bold text-[var(--ui-ink)]"><HomeCalendar initialMonthKey={calendarMonthKey} matches={calendarClientMatches} events={calendarEvents} /></AdaptiveDialog>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            {matchRows[0] ? <MatchRow match={matchRows[0]} team={team} teams={teams} /> : <p className="px-5 py-10 text-center text-sm text-[var(--ui-muted)]">등록된 경기가 없습니다.</p>}
          </div>
        </section>

        {/* 태블릿·데스크톱은 일정과 캘린더를 병렬로 제공한다. */}
        <section className="hidden gap-5 lg:grid lg:gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="min-w-0">
            <SectionHeading href={`/fan/${team.fanSiteHost}/matches`}>경기 일정</SectionHeading>
            <div className="h-[360px] divide-y divide-[var(--ui-border)] overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
              {matchRows.length ? (
                matchRows.map((match) => <MatchRow key={match.id} match={match} team={team} teams={teams} />)
              ) : (
                <p className="px-5 py-12 text-center text-sm text-[var(--ui-muted)]">등록된 경기가 없습니다.</p>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <SectionHeading>캘린더</SectionHeading>
            <HomeCalendar
              initialMonthKey={calendarMonthKey}
              matches={calendarClientMatches}
              events={calendarEvents}
            />
          </div>
        </section>

        {/* 선수단 */}
        <section>
          <Roster players={teamPlayers} teamSlug={team.fanSiteHost} />
        </section>

        {/* 소셜 피드 */}
        <section>
          <SectionHeading href={`/fan/${team.fanSiteHost}/instagram`}>소셜 피드</SectionHeading>
          <FanSocialPreview items={feedInsta} />
        </section>

        {/* 게시판 */}
        <section>
          <SectionHeading href={`/fan/${team.fanSiteHost}/community`}>게시판</SectionHeading>
          <HomeBoardCarousel posts={boardPosts.slice(0, 12)} scope="team" teamSlug={team.fanSiteHost} />
        </section>

        {/* 최신 영상 */}
        <section>
          <SectionHeading href={`/fan/${team.fanSiteHost}/videos`}>최신 영상</SectionHeading>
          <FanHomeVideoSwiper teamSlug={team.fanSiteHost} videos={feedVideos} />
        </section>

        <AdSlot className="hidden h-24 md:block" />

        <OfficialLinks team={team} />
      </div>
      </FanPageShell>
    </>
  );
}
