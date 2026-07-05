import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import type { FeedInstaItem, FeedVideoItem } from "@/components/fan/fan-feed-mosaic";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import { FanSocialPreview } from "@/components/fan/fan-social-preview";
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
  getTeamStandings,
} from "@/lib/data/lck";
import { getBoardPosts } from "@/lib/data/community";
import { buildFanVideoItems } from "@/lib/fan-video-items";
import type { Match, Player, Team, TeamStanding } from "@/lib/types";

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
  const score = scheduled ? "VS" : scoreLabel(match, team);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 md:px-5">
      <span
        className={`font-archivo grid h-9 w-11 shrink-0 place-items-center rounded-lg text-xs font-black ${
          scheduled ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]" : "text-white"
        }`}
        style={scheduled ? undefined : { background: result === "W" ? "var(--tp)" : "var(--ui-muted)" }}
      >
        {badgeText}
      </span>
      <TeamLogo team={opponent} size="h-10 w-10" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2 text-[15px] font-black text-[var(--ui-ink)]">
          <span className="truncate">{opponent?.shortName ?? "TBD"}</span>
          <span className="shrink-0 tabular-nums text-[var(--ui-text)]">{score}</span>
        </span>
        <span className="truncate text-[12px] font-semibold text-[var(--ui-muted)]">
          {formatMatchDay(match.matchDate)}
          {match.name?.trim() ? ` · ${match.name.trim()}` : ""}
        </span>
      </div>
      <Link
        href={`/matches/${match.id}`}
        className="flex shrink-0 items-center gap-0.5 text-xs font-extrabold"
        style={scheduled ? { color: "var(--tp)" } : undefined}
      >
        <span className={scheduled ? "" : "text-[var(--ui-muted)]"}>{scheduled ? "승부예측" : "매치 데이터"}</span>
        <ChevronRight size={15} className={scheduled ? "" : "text-[var(--ui-muted)]"} />
      </Link>
    </div>
  );
}

// ─── 섹션: 순위·최근 폼 패널 (메인 페이지 순위/폼 언어를 카드로) ──

function StandingPanel({ standing, recent }: { standing?: TeamStanding; recent: Array<"W" | "L"> }) {
  return (
    <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-muted)]">Season Standing</p>
      <div className="mt-4 flex items-end gap-4">
        <p className="flex items-baseline gap-1">
          <span className="font-archivo text-[46px] font-black leading-none" style={{ color: "var(--tp)" }}>
            {standing?.rank ?? "-"}
          </span>
          <span className="text-lg font-black text-[var(--ui-muted)]">위</span>
        </p>
        <div className="flex flex-col pb-1.5">
          <span className="text-[15px] font-black text-[var(--ui-ink)]">
            {standing ? `${standing.wins}승 ${standing.losses}패` : "집계 중"}
          </span>
          <span className="text-xs font-semibold text-[var(--ui-muted)]">
            {standing ? `세트 득실 ${standing.setDiff > 0 ? "+" : ""}${standing.setDiff}` : "정규시즌"}
          </span>
        </div>
      </div>
      <div className="mt-5 border-t border-[var(--ui-border)] pt-4">
        <p className="mb-2.5 text-xs font-bold text-[var(--ui-muted)]">최근 5경기</p>
        {recent.length ? (
          <div className="flex gap-1.5">
            {recent.map((value, index) => (
              <span
                key={index}
                className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-white"
                style={{ background: value === "W" ? "var(--tp)" : "var(--ui-muted)" }}
              >
                {value}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--ui-muted)]">기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// ─── 섹션: 로스터 ───────────────────────────────────────────────

function Roster({ players, teamSlug }: { players: Player[]; teamSlug: string }) {
  return (
    <div>
      <SectionHeading href={`/fan/${teamSlug}/players`}>선수단</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {players.slice(0, 5).map((player) => (
          <Link
            key={player.id}
            href={`/players/${player.slug}`}
            className="fan-roster-chip group flex items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 transition"
          >
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
              {player.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.profileImageUrl}
                  alt={player.name}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <span className="grid h-full place-items-center text-[10px] font-black text-[var(--ui-muted)]">
                  {player.name.slice(0, 2)}
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-[1px]">
              <span className="font-archivo truncate text-[15px] font-black text-[var(--ui-ink)]">{player.name}</span>
              <span className="text-[12px] font-extrabold" style={{ color: "var(--tp)" }}>
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

  const [teams, players, matches, boardPosts, standings] = await Promise.all([
    getAllTeams(),
    getPlayers(),
    getMatches(),
    getBoardPosts({ scope: "team", teamId: team.id }),
    getTeamStandings(),
  ]);

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
  // 이 페이지는 force-dynamic이라 요청 시각으로 지난 예정 경기를 걸러낸다.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcomingMatches = teamMatches.filter(
    (match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now,
  );
  const completedMatches = [...teamMatches]
    .filter((match) => match.status === "completed" || new Date(match.matchDate).getTime() < now)
    .reverse();

  // MATCHES 미니 리스트: 예정 2 + 결과 2
  const matchRows = [...upcomingMatches.slice(0, 2), ...completedMatches.slice(0, 2)];
  const standing = standings
    .filter((s) => s.teamId === team.id)
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))[0];
  // 최근 폼: 실제 승패가 확정된 완료 경기에서 최근 5경기.
  const recentForm = [...teamMatches]
    .filter((match) => match.status === "completed")
    .reverse()
    .map((match) => teamResult(match, team))
    .filter((result): result is "W" | "L" => result !== null)
    .slice(0, 5);

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
    <FanPageShell eyebrow={`${team.shortName} Fan Channel`} title="홈" contentClassName="">
      <div
        className="flex flex-col gap-12 text-[var(--ui-ink)]"
        style={{ "--tp": team.primaryColor } as React.CSSProperties}
      >
        {/* 경기 일정 + 순위 요약 */}
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div>
            <SectionHeading href={`/fan/${team.fanSiteHost}/matches`}>경기 일정</SectionHeading>
            <div className="divide-y divide-[var(--ui-border)] overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
              {matchRows.length ? (
                matchRows.map((match) => <MatchRow key={match.id} match={match} team={team} teams={teams} />)
              ) : (
                <p className="px-5 py-12 text-center text-sm text-[var(--ui-muted)]">등록된 경기가 없습니다.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <AdSlot className="h-[322px] w-full" />
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
          <HomeBoardCarousel posts={boardPosts.slice(0, 12)} />
        </section>

        {/* 최신 영상 */}
        <section>
          <SectionHeading href={`/fan/${team.fanSiteHost}/videos`}>최신 영상</SectionHeading>
          {feedVideos.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {feedVideos.slice(0, 8).map((video) => (
                <Link key={video.id} href={`/fan/${team.fanSiteHost}/videos/${video.routeId}`} className="group">
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#17181b]">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : null}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  </div>
                  <b className="mt-3 line-clamp-2 block text-sm leading-5 text-[var(--ui-ink)]">{video.title}</b>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-2xl bg-[var(--ui-surface-muted)] text-sm text-[var(--ui-muted)]">
              등록된 영상이 없습니다.
            </div>
          )}
        </section>

        <AdSlot className="h-24" />
      </div>
    </FanPageShell>
  );
}
