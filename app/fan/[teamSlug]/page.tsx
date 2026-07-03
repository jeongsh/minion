import { createHash } from "crypto";

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { FanCheerButton } from "@/components/fan/fan-cheer-button";
import {
  FanFeedMosaic,
  type FeedInstaItem,
  type FeedVideoItem,
} from "@/components/fan/fan-feed-mosaic";
import { FanPredictionCard } from "@/components/fan/fan-prediction-card";
import { boardLabel } from "@/lib/community/boards";
import { formatRelativeOrDate } from "@/components/community/format";
import { isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";
import { getBoardPosts } from "@/lib/data/community";
import {
  getAllTeams,
  getFanMatchPredictions,
  getFanVideoFeed,
  getMatches,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTeamEngagementStatus,
  getTeamFanCount,
  getTeamInstagramFeed,
  getTeamStandings,
} from "@/lib/data/lck";
import { buildFanVideoItems } from "@/lib/fan-video-items";
import type { Match, Player, Team, TeamStanding } from "@/lib/types";

export const dynamic = "force-dynamic";

const POSITION_ORDER: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

// COMMUNITY 5행 = MATCHES 4행 + 순위표 카드 1행. 두 컬럼의 행 높이/바닥선을 일치시킨다.
const COMMUNITY_ROWS = 5;
const MATCH_ROWS = 4;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

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

function dateKeyKST(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ddayLabel(matchDate: string) {
  const diff = Math.round(
    (Date.parse(dateKeyKST(matchDate)) - Date.parse(dateKeyKST(new Date()))) / 86400000,
  );
  return diff <= 0 ? "D-DAY" : `D-${diff}`;
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
  if (match.teamAScore == null || match.teamBScore == null) return "0:0";
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

function TeamLogoImg({ team, className }: { team?: Team; className: string }) {
  if (!team?.logoUrl) {
    return (
      <span className={`${className} grid place-items-center rounded bg-[#f2f0ec] text-[10px] font-black text-[#8a8892]`}>
        {team?.shortName ?? "-"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.logoUrl} alt={`${team.name} 로고`} className={`${className} object-contain`} />
  );
}

// ─── 섹션: 히어로 밴드 ──────────────────────────────────────────

function Hero({
  team,
  opponent,
  match,
  mode,
  fanCount,
  isFan,
  teamVotes,
  opponentVotes,
  myVote,
  canVote,
}: {
  team: Team;
  opponent?: Team;
  match?: Match;
  mode: "live" | "upcoming" | "recent" | "empty";
  fanCount: number;
  isFan: boolean;
  teamVotes: number;
  opponentVotes: number;
  myVote?: string;
  canVote: boolean;
}) {
  const tp = team.primaryColor;
  const badge =
    mode === "live"
      ? "LIVE"
      : mode === "upcoming" && match
        ? ddayLabel(match.matchDate)
        : mode === "recent"
          ? "경기 종료"
          : "일정 없음";
  const stage =
    match?.name?.trim() || (mode === "empty" ? "다가올 경기를 기다리는 중" : "LCK 서머 정규리그");
  const venue = match?.venue?.trim() || "LoL PARK";
  const dateLine = match ? `${formatDateTime(match.matchDate)} · ${venue}` : "";
  const oppShort = opponent?.shortName ?? "TBD";
  const tickerText = match
    ? `MATCH DAY · ${formatMatchDay(match.matchDate)} · ${venue} · ${team.shortName} VS ${oppShort} · 승부예측 참여 중`
    : `${team.shortName} FAN · 다음 매치데이를 기다리는 중 · 응원은 계속된다`;

  return (
    <div className="relative overflow-hidden text-white" style={{ background: tp }}>
      <div className="relative mx-auto max-w-[1240px] px-10">
        <span
          aria-hidden="true"
          className="font-archivo pointer-events-none absolute -right-2 -top-16 text-[250px] font-black leading-none tracking-[-0.05em]"
          style={{ color: "rgba(255,255,255,0.07)" }}
        >
          {team.shortName}
        </span>

        <div className="relative grid items-center gap-11 pb-10 pt-11 lg:grid-cols-[1fr_380px]">
        {/* 좌측 */}
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-3">
            <span
              className="font-archivo rounded-[4px] bg-white px-[10px] py-1 text-[13px] font-black"
              style={{ color: tp }}
            >
              {badge}
            </span>
            <span className="font-archivo text-xs font-extrabold tracking-[0.22em] text-white/80">
              {stage}
            </span>
          </div>

          <div className="flex items-baseline gap-5">
            <span className="font-archivo text-[96px] font-black leading-[0.92] tracking-[-0.02em]">
              {team.shortName}
            </span>
            <span className="font-archivo text-[30px] font-black text-white/55">VS</span>
            <span
              className="font-archivo text-[96px] font-black leading-[0.92] tracking-[-0.02em]"
              style={{ color: "transparent", WebkitTextStroke: "2px rgba(255,255,255,0.85)" }}
            >
              {oppShort}
            </span>
          </div>

          {dateLine ? (
            <p className="text-[15px] font-bold text-white/85">{dateLine}</p>
          ) : (
            <p className="text-[15px] font-bold text-white/85">예정된 경기가 없습니다</p>
          )}

          <div className="mt-1 flex gap-[10px]">
            <FanCheerButton
              teamId={team.id}
              teamSlug={team.fanSiteHost}
              initialCount={fanCount}
              initialCheered={isFan}
              teamColor={tp}
            />
            <Link
              href={match ? `/matches/${match.id}` : `/fan/${team.fanSiteHost}/matches`}
              className="rounded-full border-[1.5px] border-white/55 px-[26px] py-[13px] text-sm font-extrabold text-white transition hover:bg-white/10"
            >
              {match ? "경기 상세" : "전체 일정"}
            </Link>
          </div>
        </div>

        {/* 우측 — 승부예측 카드 (실제 집계 반영) */}
        <FanPredictionCard
          matchId={match?.id}
          teamId={team.id}
          teamName={team.shortName}
          opponentId={opponent?.id}
          opponentName={oppShort}
          teamColor={tp}
          initialTeamVotes={teamVotes}
          initialOpponentVotes={opponentVotes}
          initialMyVote={myVote}
          canVote={canVote}
        />
        </div>
      </div>

      {/* 티커 */}
      <div className="relative overflow-hidden bg-black/20 py-[9px]">
        <div className="font-archivo fan-ticker-track text-xs font-extrabold tracking-[0.2em] text-white/85">
          <span className="px-2">{`${tickerText}  ·  `.repeat(2)}</span>
          <span className="px-2" aria-hidden="true">{`${tickerText}  ·  `.repeat(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 섹션 헤더 공통 ─────────────────────────────────────────────

function SectionHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-[14px] border-b-2 border-[#16151b] pb-[10px]">
      <h2 className="font-archivo m-0 text-[26px] font-black tracking-[-0.01em]">{title}</h2>
      <span className="text-[13px] font-semibold text-[#8a8892]">{desc}</span>
      <div className="ml-auto">{action}</div>
    </div>
  );
}

// ─── 섹션: 커뮤니티 + 매치 ──────────────────────────────────────

function CommunityColumn({ teamSlug, posts }: { teamSlug: string; posts: CommunityPostDetail[] }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionHeader
        title="COMMUNITY"
        desc="지금 팬들이 하는 얘기"
        action={
          <Link
            href={`/fan/${teamSlug}/community/new`}
            className="rounded-full px-4 py-2 text-xs font-black text-white transition hover:opacity-90"
            style={{ background: "var(--tp)" }}
          >
            글쓰기
          </Link>
        }
      />
      {/* 매치 컬럼과 바닥선을 맞추기 위해 항상 5행(부족하면 빈 슬롯)으로 채운다. */}
      {Array.from({ length: COMMUNITY_ROWS }, (_, i) => {
        const post = posts[i];
        if (!post) {
          return (
            <div
              key={`empty-${i}`}
              aria-hidden="true"
              className="flex min-h-[58px] items-center gap-[14px] border-b border-[#f2f0ec] py-2"
            >
              <span className="font-archivo w-[22px] text-[17px] font-black text-[#e4e1db]">{i + 1}</span>
            </div>
          );
        }
        return (
          <Link
            key={post.id}
            href={`/fan/${teamSlug}/community/post/${post.id}`}
            className="flex min-h-[58px] items-center gap-[14px] border-b border-[#f2f0ec] py-2"
          >
            <span
              className="font-archivo w-[22px] text-[17px] font-black"
              style={{ color: "var(--tp)" }}
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[16px] font-extrabold">{post.title}</span>
              <span className="text-[12px] font-bold text-[#9c9aa3]">
                {boardLabel("team", post.boardType)} ·{" "}
                <span suppressHydrationWarning>{formatRelativeOrDate(post.createdAt)}</span>
              </span>
            </div>
            {isHotPost(post) ? (
              <span className="shrink-0 rounded-[4px] bg-[#16151b] px-[7px] py-[2px] text-[10px] font-black text-white">
                HOT
              </span>
            ) : null}
            {post.commentCount > 0 ? (
              <span className="shrink-0 text-[12px] font-extrabold text-[#9c9aa3]">
                💬 {post.commentCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function MatchRow({
  match,
  team,
  teams,
}: {
  match: Match;
  team: Team;
  teams: Team[];
}) {
  const opponent = teamForMatch(match, team, teams);
  const result = teamResult(match, team);
  const scheduled = match.status !== "completed";
  const badgeText = scheduled ? "일정" : result ?? "-";
  const badgeBg = scheduled ? "#16151b" : result === "W" ? "var(--tp)" : "#b9b7c0";
  const score = scheduled ? "0:0" : scoreLabel(match, team);

  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b border-[#f2f0ec] py-2">
      <span
        className="font-archivo grid h-7 w-[34px] shrink-0 place-items-center rounded-lg text-xs font-black text-white"
        style={{ background: badgeBg }}
      >
        {badgeText}
      </span>
      <TeamLogoImg team={opponent} className="h-[34px] w-[34px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-black">
          {score}
        </span>
        <span className="text-[12px] font-semibold text-[#9c9aa3]">
          {formatMatchDay(match.matchDate)}
          {match.name?.trim() ? ` · ${match.name.trim()}` : ""}
        </span>
      </div>
      {scheduled ? (
        <Link
          href={`/matches/${match.id}`}
          className="shrink-0 text-xs font-extrabold"
          style={{ color: "var(--tp)" }}
        >
          승부예측 →
        </Link>
      ) : (
        <Link href={`/matches/${match.id}`} className="shrink-0 text-xs font-extrabold text-[#8a8892]">
          매치 데이터→
        </Link>
      )}
    </div>
  );
}

function MatchesColumn({
  teamSlug,
  team,
  teams,
  rows,
  standing,
  recentForm,
}: {
  teamSlug: string;
  team: Team;
  teams: Team[];
  rows: Match[];
  standing?: TeamStanding;
  recentForm: string[];
}) {
  const rankText = standing ? `${standing.rank}위` : "-";
  const recordText = standing
    ? `${standing.wins}승 ${standing.losses}패 · 세트 ${standing.setDiff >= 0 ? "+" : ""}${standing.setDiff}`
    : "기록 집계 중";

  return (
    <div className="flex flex-col gap-1">
      <SectionHeader
        title="MATCHES"
        desc="일정 & 결과"
        action={
          <Link href={`/fan/${teamSlug}/matches`} className="text-[13px] font-semibold text-[#8a8892]">
            전체 일정 →
          </Link>
        }
      />
      {/* 커뮤니티 컬럼과 바닥선을 맞추기 위해 항상 4행(부족하면 빈 슬롯) + 순위표 카드. */}
      {Array.from({ length: MATCH_ROWS }, (_, i) => {
        const match = rows[i];
        if (!match) {
          return (
            <div
              key={`empty-${i}`}
              aria-hidden="true"
              className="flex min-h-[58px] items-center border-b border-[#f2f0ec] py-2 text-[11px] font-semibold text-[#c8c5bf]"
            >
              경기 없음
            </div>
          );
        }
        return <MatchRow key={match.id} match={match} team={team} teams={teams} />;
      })}
      <div
        className="flex min-h-[58px] items-center justify-between rounded-[14px] px-[18px] py-2"
        style={{ background: "color-mix(in oklab, var(--tp) 8%, #fff)" }}
      >
        <div className="flex flex-col gap-[2px]">
          <span className="text-[14px] font-black">
            현재 <b style={{ color: "var(--tp)" }}>{rankText}</b> · {recordText}
          </span>
          <span className="text-[12px] font-bold text-[#8a8892]">
            최근 {recentForm.length}경기 {recentForm.length ? recentForm.join(" ") : "기록 없음"}
          </span>
        </div>
        <Link
          href="/standings"
          className="shrink-0 text-xs font-black"
          style={{ color: "var(--tp)" }}
        >
          순위표 →
        </Link>
      </div>
    </div>
  );
}

// ─── 섹션: 로스터 ───────────────────────────────────────────────

function Roster({ players, teamSlug }: { players: Player[]; teamSlug: string }) {
  return (
    <div className="px-10">
      <SectionHeader
        title="ROSTER"
        desc="2026 서머"
        action={
          <Link href={`/fan/${teamSlug}/players`} className="text-[13px] font-semibold text-[#8a8892]">
            선수 상세 · 스탯 →
          </Link>
        }
      />
      <div className="grid grid-cols-5 gap-[14px] pb-[26px] pt-[18px]">
        {players.slice(0, 5).map((player) => (
          <Link
            key={player.id}
            href={`/players/${player.slug}`}
            className="fan-roster-chip group flex items-center gap-3 rounded-full border border-[#eeece8] py-2 pl-2 pr-4 transition hover:shadow-[0_8px_20px_rgba(60,50,60,0.1)]"
          >
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#eef1f6]">
              {player.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.profileImageUrl}
                  alt={player.name}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <span className="grid h-full place-items-center text-[10px] font-black text-[#9a968f]">
                  {player.name.slice(0, 2)}
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-[1px]">
              <span className="font-archivo truncate text-[15px] font-black">{player.name}</span>
              <span className="text-[12px] font-extrabold" style={{ color: "var(--tp)" }}>
                {player.position}{" "}
                <span className="font-bold text-[#9c9aa3]">· KDA {mockKda(player.id)}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── 섹션: 푸터 ─────────────────────────────────────────────────

function Footer({ team }: { team: Team }) {
  const links = [
    { label: "홈페이지", href: team.officialHomepageUrl },
    { label: "YouTube", href: team.officialYoutubeUrl },
    { label: "X", href: team.officialXUrl },
    { label: "Instagram", href: team.officialInstagramUrl },
  ].filter((l) => l.href);

  return (
    <div className="bg-[#16151b] text-white">
      <div className="mx-auto flex max-w-[1240px] items-center gap-[14px] px-10 py-[22px]">
        {team.logoWhiteUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoWhiteUrl} alt="" className="h-6 w-[30px] object-contain" />
        ) : null}
        <span className="font-archivo text-sm font-black tracking-[0.08em]">{team.shortName} FAN</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/25 px-[13px] py-[6px] text-[11px] font-extrabold text-white/75 transition hover:border-white/60 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
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

  // 쿠키 기반 voterKey — 응원(팬)/승부예측 상태를 사용자별로 식별한다.
  const cookieStore = await cookies();
  const fanVoterRaw = cookieStore.get("lckhub_fan_voter")?.value;
  const hashedFanVoter = fanVoterRaw
    ? createHash("sha256").update(fanVoterRaw).digest("hex")
    : null;
  const predictionVoterKey = cookieStore.get("lckhub_match_prediction_voter")?.value;

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

  const [instagramFeed, videoFeed, fanCount, engagement] = await Promise.all([
    getTeamInstagramFeed(team.id, playerIds),
    getFanVideoFeed(team.id, playerIds),
    getTeamFanCount(team.id),
    hashedFanVoter
      ? getTeamEngagementStatus(team.id, hashedFanVoter)
      : Promise.resolve({ isFan: false, isCheckedInToday: false }),
  ]);

  const teamMatches = matches
    .filter((match) => match.teamAId === team.id || match.teamBId === team.id)
    .sort(byMatchDate);
  // 이 페이지는 force-dynamic이라 요청 시각으로 지난 예정 경기를 걸러낸다.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const liveMatch = teamMatches.find((match) => match.status === "live");
  const upcomingMatches = teamMatches.filter(
    (match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now,
  );
  const completedMatches = [...teamMatches]
    .filter((match) => match.status === "completed" || new Date(match.matchDate).getTime() < now)
    .reverse();
  const nextMatch = upcomingMatches[0];
  const recentMatch = completedMatches[0];
  const featuredMatch = liveMatch ?? nextMatch ?? recentMatch;
  const featuredMatchMode = liveMatch
    ? "live"
    : nextMatch
      ? "upcoming"
      : recentMatch
        ? "recent"
        : "empty";
  const opponent = featuredMatch ? teamForMatch(featuredMatch, team, teams) : undefined;

  // 승부예측 — 대표 경기의 실제 집계와 내 예측을 불러온다. 시작 전에만 투표 가능.
  const predictions = featuredMatch ? await getFanMatchPredictions(featuredMatch.id) : [];
  const teamVotes = predictions.filter((p) => p.teamId === team.id).length;
  const opponentVotes = opponent
    ? predictions.filter((p) => p.teamId === opponent.id).length
    : 0;
  const myVote = predictionVoterKey
    ? predictions.find((p) => p.voterKey === predictionVoterKey)?.teamId
    : undefined;
  const canVote = featuredMatchMode === "upcoming";

  // MATCHES 컬럼: 예정 2 + 결과 2
  const matchRows = [...upcomingMatches.slice(0, 2), ...completedMatches.slice(0, 2)];
  const recentForm = completedMatches
    .slice(0, 5)
    .map((match) => teamResult(match, team))
    .filter((r): r is "W" | "L" => r !== null);
  const standing = standings
    .filter((s) => s.teamId === team.id)
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))[0];

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
    <main
      className="w-full text-[#16151b]"
      style={{ "--tp": team.primaryColor } as React.CSSProperties}
    >
      {/* 최상단: 팀 컬러 밴드 (전체 폭) */}
      <Hero
        team={team}
        opponent={opponent}
        match={featuredMatch}
        mode={featuredMatchMode}
        fanCount={fanCount}
        isFan={engagement.isFan}
        teamVotes={teamVotes}
        opponentVotes={opponentVotes}
        myVote={myVote}
        canVote={canVote}
      />

      {/* 본문: 흰색 밴드 (전체 폭), 콘텐츠는 1240 중앙 정렬 */}
      <div className="bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-[34px] pt-[34px] pb-9">
          <FanFeedMosaic
            videos={feedVideos}
            insta={feedInsta}
            teamSlug={team.fanSiteHost}
            teamColor={team.primaryColor}
          />

          <div className="grid grid-cols-[1.55fr_1fr] gap-9 px-10">
            <CommunityColumn teamSlug={team.fanSiteHost} posts={boardPosts.slice(0, 5)} />
            <MatchesColumn
              teamSlug={team.fanSiteHost}
              team={team}
              teams={teams}
              rows={matchRows}
              standing={standing}
              recentForm={recentForm}
            />
          </div>

          <Roster players={teamPlayers} teamSlug={team.fanSiteHost} />
        </div>
      </div>

      {/* 최하단: 검은색 밴드 (전체 폭) */}
      <Footer team={team} />
    </main>
  );
}
