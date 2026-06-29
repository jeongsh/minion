import Link from "next/link";

import { HomeHeroSwiper, type HomeHeroSwiperSlide } from "@/components/domain/home-hero-swiper";
import { HomeMatchCalendar, type HomeCalendarMatch } from "@/components/domain/home-match-calendar";
import { teams as themeTeams } from "@/lib/team-themes";
import type { FanMatchPrediction, Match, Team, TeamVideo } from "@/lib/types";
import { formatDateTime, matchHref } from "@/lib/view-data";

const TEAM_SHORTCUT_ORDER = ["T1", "GEN", "GENG", "HLE", "DK", "KT", "DRX", "NS", "FOX", "BRO", "KDF", "SOOP"];

export type HomeStandingRow = {
  team: Team;
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  setDiff: number;
  recent: Array<"W" | "L">;
};

type HomeDashboardProps = {
  teams: Team[];
  standingRows: HomeStandingRow[];
  upcomingMatches: Match[];
  recentMatches: Match[];
  predictionsByMatchId: Map<string, FanMatchPrediction[]>;
  tournamentNamesById: Map<string, string>;
  calendarMonthKey: string;
  calendarMatches: HomeCalendarMatch[];
  latestVideos: TeamVideo[];
  heroSlides: HomeHeroSwiperSlide[];
};

function Card({ children, className = "", ...props }: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section {...props} className={`rounded-lg border border-[#e8ecf5] bg-white ${className}`}>
      {children}
    </section>
  );
}

function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 className="text-lg font-black text-[#111827]">{title}</h2>
      {href && linkLabel ? (
        <Link href={href} className="text-xs font-bold text-[#7c86a0] transition hover:text-[#4f46e5]">
          {linkLabel} <span aria-hidden="true">&gt;</span>
        </Link>
      ) : null}
    </div>
  );
}

function TeamLogo({
  team,
  size = "md",
  plain = false,
}: {
  team?: Team;
  size?: "sm" | "md" | "lg" | "xl";
  plain?: boolean;
}) {
  const sizeClass = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-14 w-14 sm:h-16 sm:w-16",
    xl: "h-14 w-14 sm:h-[68px] sm:w-[68px]",
  }[size];

  if (!team) {
    return <span className={`${sizeClass} rounded-lg bg-[#eef2f8]`} />;
  }

  return (
    <span className={`grid ${sizeClass} place-items-center ${plain ? "" : "rounded-lg bg-white"}`}>
      {team.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs font-black text-[#6b7280]">{team.shortName.slice(0, 3)}</span>
      )}
    </span>
  );
}

function AiBriefingPlaceholder() {
  return (
    <Card className="relative min-h-[380px] overflow-hidden bg-[#f4f5ff] p-7" data-testid="ai-briefing-placeholder">
      <div className="relative z-10 flex h-full flex-col">
        <span className="w-fit rounded-full border border-[#b8b4ff] bg-white px-3 py-1.5 text-xs font-black text-[#655cff]">
          AI 브리핑
        </span>
        <h2 className="mt-5 text-3xl font-black leading-tight text-[#111827]">오늘의 LCK</h2>
        <p className="mt-2 text-xs font-bold text-[#8a93a8]">업데이트 준비 중</p>
        <p className="mt-6 max-w-[245px] text-sm font-semibold leading-6 text-[#59647c]">
          오늘의 경기와 주요 이슈를 한눈에 볼 수 있는 브리핑 영역입니다.
        </p>
        <span className="mt-6 inline-flex h-11 w-fit items-center rounded-full bg-[#101a3d] px-5 text-sm font-black text-white">
          AI 브리핑 준비 중
        </span>
        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#667085]">핵심 이슈</span>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#667085]">선수별 TOP 5</span>
        </div>
      </div>
      <div className="absolute bottom-7 right-7 grid h-24 w-24 place-items-center rounded-lg border border-white bg-white/80 text-3xl font-black text-[#746cf5] shadow-sm">
        AI
      </div>
    </Card>
  );
}

function ParticipationSection({ upcomingMatches }: { upcomingMatches: Match[] }) {
  const entries = [
    {
      label: "승부예측",
      description: upcomingMatches.length > 0 ? `${upcomingMatches.length}개 경기 예측 가능` : "다음 경기 준비 중",
      status: upcomingMatches.length > 0 ? "진행 중" : "예정",
      icon: "VS",
      href: upcomingMatches[0] ? matchHref(upcomingMatches[0]) : "/schedule",
      accent: "bg-[#eceaff] text-[#6258ff]",
    },
    {
      label: "팀 순위",
      description: "최신 순위와 최근 폼",
      status: "업데이트",
      icon: "#",
      href: "/standings",
      accent: "bg-[#e8f7ff] text-[#007ea8]",
    },
    {
      label: "팬 커뮤니티",
      description: "응원과 경기 이야기",
      status: "참여 가능",
      icon: "FAN",
      href: "/community",
      accent: "bg-[#fff0f3] text-[#d63b63]",
    },
  ];

  return (
    <section aria-labelledby="participation-title">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="participation-title" className="text-lg font-black text-[#111827]">
          지금 참여 가능
        </h2>
        <Link href="/schedule" className="text-xs font-bold text-[#7c86a0] transition hover:text-[#4f46e5]">
          전체 보기 <span aria-hidden="true">&gt;</span>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {entries.map((entry) => (
          <Link
            key={entry.label}
            href={entry.href}
            className="group flex min-h-[122px] flex-col rounded-lg border border-[#e7ebf3] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#cfd5e3] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-10 min-w-10 place-items-center rounded-lg px-2 text-xs font-black ${entry.accent}`}>
                {entry.icon}
              </span>
              <span className="rounded bg-[#fff0f3] px-2 py-1 text-[10px] font-black text-[#f04465]">{entry.status}</span>
            </div>
            <p className="mt-3 text-sm font-black text-[#111827]">{entry.label}</p>
            <p className="mt-1 text-xs font-semibold text-[#7c86a0]">{entry.description}</p>
            <span className="mt-auto pt-3 text-center text-xs font-black text-[#4b556b] group-hover:text-[#4f46e5]">바로가기</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AdPlaceholder({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <aside
      aria-label="광고 영역"
      className={`grid place-items-center rounded-lg bg-[#e6e7eb] text-xl font-black text-[#666b76] ${
        compact ? "min-h-14" : "min-h-[170px]"
      } ${className}`}
    >
      광고영역
    </aside>
  );
}

function votePercents(match: Match, predictions: FanMatchPrediction[]) {
  const left = predictions.filter((item) => item.teamId === match.teamAId).length;
  const right = predictions.filter((item) => item.teamId === match.teamBId).length;
  const total = left + right;

  if (total === 0) return { left: 50, right: 50 };

  const leftPercent = Math.round((left / total) * 100);
  return { left: leftPercent, right: 100 - leftPercent };
}

function MatchPollCard({
  match,
  teamA,
  teamB,
  predictions,
  tournamentName,
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  predictions: FanMatchPrediction[];
  tournamentName?: string;
}) {
  const percents = votePercents(match, predictions);
  const accent = teamA?.primaryColor || "#ff315d";
  const opposingAccent = teamB?.primaryColor || "#315efb";

  return (
    <Link
      href={matchHref(match)}
      className="group rounded-lg border border-[#e7ebf3] bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-[#cfd5e3] hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-1 text-xs font-black text-[#111827]">{tournamentName ?? match.name}</p>
        <p className="shrink-0 text-[11px] font-semibold text-[#7c86a0]">{formatDateTime(match.matchDate)}</p>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamLogo team={teamA} size="lg" />
          <span className="min-h-8 text-sm font-black leading-tight text-[#111827]">{teamA?.shortName ?? "TBD"}</span>
        </div>
        <span className="text-sm font-black text-[#69738d]">VS</span>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamLogo team={teamB} size="lg" />
          <span className="min-h-8 text-sm font-black leading-tight text-[#111827]">{teamB?.shortName ?? "TBD"}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm font-black">
        <span style={{ color: accent }}>{percents.left}%</span>
        <span style={{ color: opposingAccent }}>{percents.right}%</span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[#e3e7ef]">
        <span className="h-full" style={{ width: `${percents.left}%`, backgroundColor: accent }} />
        <span className="h-full flex-1" style={{ backgroundColor: opposingAccent }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eef1f6] pt-3">
        <span className="rounded-full bg-[#f3f2ff] px-3 py-1.5 text-[11px] font-bold text-[#746cf5]">AI 코멘트 준비 중</span>
        <span className="rounded-full bg-[#f4f6f9] px-3 py-1.5 text-[11px] font-bold text-[#667085] transition group-hover:bg-[#eceff4]">
          팬 예측 보기
        </span>
      </div>
    </Link>
  );
}

function StandingsTable({ rows }: { rows: HomeStandingRow[] }) {
  return (
    <Card className="p-4">
      <SectionHeading title="LCK 순위" href="/standings" linkLabel="전체 순위" />
      <div className="grid grid-cols-[34px_minmax(70px,1fr)_54px_58px_40px] border-b border-[#eef1f7] pb-2 text-xs font-black text-[#7c86a0]">
        <span>순위</span>
        <span>팀</span>
        <span className="text-right">승패</span>
        <span className="text-right">득실차</span>
        <span className="text-right">연속</span>
      </div>
      <div className="divide-y divide-[#f1f4f8]">
        {rows.slice(0, 5).map((row) => (
          <Link
            href={`/teams/${row.team.slug}`}
            key={row.teamId}
            className="grid grid-cols-[34px_minmax(70px,1fr)_54px_58px_40px] items-center py-2 text-sm"
          >
            <span className="font-black text-[#111827]">{row.rank}</span>
            <span className="flex min-w-0 items-center gap-2 font-semibold text-[#64708f]">
              <TeamLogo team={row.team} size="sm" />
              <span className="truncate">{row.team.shortName}</span>
            </span>
            <span className="text-right font-semibold text-[#64708f]">{row.wins}-{row.losses}</span>
            <span className="text-right font-semibold text-[#64708f]">{row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}</span>
            <span className={`text-right font-black ${row.recent[0] === "W" ? "text-[#13a976]" : "text-[#e0445e]"}`}>
              {row.recent[0] ?? "-"}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function FormTable({ rows }: { rows: HomeStandingRow[] }) {
  return (
    <Card className="p-4">
      <SectionHeading title="팀 최근 폼" href="/standings" linkLabel="전체 보기" />
      <div className="grid grid-cols-[34px_minmax(70px,1fr)_118px] border-b border-[#eef1f7] pb-2 text-xs font-black text-[#7c86a0]">
        <span>순위</span>
        <span>팀</span>
        <span className="text-right">최근 5경기</span>
      </div>
      <div className="divide-y divide-[#f1f4f8]">
        {rows.slice(0, 5).map((row) => (
          <Link
            href={`/teams/${row.team.slug}`}
            key={row.teamId}
            className="grid grid-cols-[34px_minmax(70px,1fr)_118px] items-center py-2 text-sm"
          >
            <span className="font-black text-[#111827]">{row.rank}</span>
            <span className="flex min-w-0 items-center gap-2 font-semibold text-[#64708f]">
              <TeamLogo team={row.team} size="sm" />
              <span className="truncate">{row.team.shortName}</span>
            </span>
            <span className="flex justify-end gap-1">
              {row.recent.slice(0, 5).map((result, index) => (
                <span
                  key={`${row.teamId}-${index}`}
                  className={`grid h-5 w-5 place-items-center rounded text-[10px] font-black text-white ${
                    result === "W" ? "bg-[#14c784]" : "bg-[#c72f4a]"
                  }`}
                >
                  {result}
                </span>
              ))}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function RecentMatchCard({
  match,
  teamA,
  teamB,
  tournamentName,
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  tournamentName?: string;
}) {
  return (
    <article className="rounded-lg border border-[#e7ebf3] bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-[#7c86a0]">
        <span className="truncate">{tournamentName ?? match.name}</span>
        <span className="shrink-0">{formatDateTime(match.matchDate)}</span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center justify-center gap-3">
          <TeamLogo team={teamA} size="md" />
          <span className="text-sm font-black text-[#111827]">{teamA?.shortName ?? "TBD"}</span>
        </div>
        <div className="flex items-center gap-3 text-2xl font-black text-[#111827]">
          <span>{match.teamAScore ?? "-"}</span>
          <span className="text-sm text-[#a0a8bb]">:</span>
          <span>{match.teamBScore ?? "-"}</span>
        </div>
        <div className="flex flex-row-reverse items-center justify-center gap-3">
          <TeamLogo team={teamB} size="md" />
          <span className="text-sm font-black text-[#111827]">{teamB?.shortName ?? "TBD"}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 border-t border-[#eef1f6] pt-3">
        <Link href={matchHref(match)} className="rounded border border-[#dfe3eb] px-4 py-2 text-xs font-bold text-[#59647c] hover:bg-[#f7f8fa]">
          경기 상세
        </Link>
        <Link
          href={`${matchHref(match)}?tab=rating`}
          className="rounded border border-[#c9c5ff] bg-[#f3f2ff] px-4 py-2 text-xs font-black text-[#655cff] hover:bg-[#eceaff]"
        >
          평점 투표
        </Link>
      </div>
    </article>
  );
}

function AiSummaryPlaceholder() {
  const rows = ["경기 흐름", "팀 전력 변화", "선수 퍼포먼스"];

  return (
    <Card className="h-full p-5" data-testid="ai-summary-placeholder">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-[#111827]">AI 최근 흐름 요약</h2>
        <span className="rounded bg-[#f3f2ff] px-2 py-1 text-[10px] font-black text-[#655cff]">준비 중</span>
      </div>
      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <div key={row} className="grid grid-cols-[32px_1fr] items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black ${index === 1 ? "bg-[#fff5d9] text-[#b98200]" : index === 2 ? "bg-[#e8f9f2] text-[#0b9b67]" : "bg-[#f0efff] text-[#655cff]"}`}>
              AI
            </span>
            <div>
              <p className="text-xs font-black text-[#59647c]">{row}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-[#edf0f5]" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function VideoSection({ videos, teamsById }: { videos: TeamVideo[]; teamsById: Map<string, Team> }) {
  return (
    <section>
      <SectionHeading title="LCK 영상" />
      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e8ecf5] bg-[#f8f9fc] px-4 py-10 text-center text-sm font-semibold text-[#64708f]">
          등록된 LCK 영상이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
          <a
            href={videos[0].videoUrl}
            className="group relative min-h-40 overflow-hidden rounded-lg bg-[#101322]"
            target="_blank"
            rel="noopener noreferrer"
          >
            {videos[0].thumbnailUrl ? (
              <img src={videos[0].thumbnailUrl} alt={videos[0].title} className="h-full w-full object-cover opacity-85" />
            ) : (
              <div className="grid h-full min-h-40 place-items-center bg-[#161b2d] text-sm font-bold text-white/70">No thumbnail</div>
            )}
            <span className="absolute inset-x-0 bottom-0 h-24 bg-black/70" />
            <span className="absolute bottom-4 left-4 right-4 line-clamp-2 text-sm font-black text-white">{videos[0].title}</span>
            <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-black/45 text-xs font-black text-white">
              PLAY
            </span>
          </a>
          <div className="flex flex-col gap-3">
            {videos.slice(1, 4).map((video) => {
              const team = teamsById.get(video.teamId);
              return (
                <a
                  key={video.id}
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid grid-cols-[82px_1fr] gap-3 rounded-lg border border-[#edf0f5] bg-white p-2 transition hover:border-[#cfd5e3]"
                >
                  <div className="relative h-14 overflow-hidden rounded bg-[#eef2f8]">
                    {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 self-center">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-[#59647c]">{video.title}</p>
                    {team ? <p className="mt-1 text-[11px] font-bold text-[#a0a8bb]">{team.shortName}</p> : null}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function TeamShortcutGrid({ teams }: { teams: Team[] }) {
  const sortedTeams = [...teams].sort((a, b) => {
    const aIndex = TEAM_SHORTCUT_ORDER.indexOf(a.shortName.toUpperCase());
    const bIndex = TEAM_SHORTCUT_ORDER.indexOf(b.shortName.toUpperCase());
    const safeA = aIndex === -1 ? 999 : aIndex;
    const safeB = bIndex === -1 ? 999 : bIndex;
    if (safeA !== safeB) return safeA - safeB;
    return a.shortName.localeCompare(b.shortName);
  });

  return (
    <section>
      <SectionHeading title="팀 팬사이트 바로가기" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sortedTeams.slice(0, 10).map((team) => {
          const themeTeam = themeTeams.find((item) => item.id === team.id);
          const fanSlug = themeTeam?.fanSiteHost ?? team.slug;

          return (
            <Link
              key={team.id}
              href={`/fan/${fanSlug}`}
              className="group flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-lg border border-[#d9dee8] bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-[#b9c1d0] hover:shadow-md"
            >
              <TeamLogo team={team} size="xl" plain />
              <span className="text-xs font-black text-[#111827]">{team.shortName}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HomeDashboard({
  teams,
  standingRows,
  upcomingMatches,
  recentMatches,
  predictionsByMatchId,
  tournamentNamesById,
  calendarMonthKey,
  calendarMatches,
  latestVideos,
  heroSlides,
}: HomeDashboardProps) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const rankedIds = new Set(standingRows.map((row) => row.teamId));
  const lckTeams = [
    ...standingRows.map((row) => row.team),
    ...teams.filter((team) => team.isLckTeam && team.isActive !== false && !rankedIds.has(team.id)),
  ];

  return (
    <main data-testid="home-dashboard" className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 pb-8 pt-6 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,2.35fr)_minmax(300px,0.85fr)]">
        <HomeHeroSwiper slides={heroSlides} />
        <AiBriefingPlaceholder />
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)]">
        <ParticipationSection upcomingMatches={upcomingMatches} />
        <AdPlaceholder />
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)]">
        <section aria-labelledby="upcoming-matches-title">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="upcoming-matches-title" className="text-lg font-black text-[#111827]">다가오는 경기</h2>
            <Link href="/schedule" className="text-xs font-bold text-[#7c86a0] transition hover:text-[#4f46e5]">
              전체 일정 <span aria-hidden="true">&gt;</span>
            </Link>
          </div>
          {upcomingMatches.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingMatches.map((match) => (
                <MatchPollCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.teamAId)}
                  teamB={teamsById.get(match.teamBId)}
                  predictions={predictionsByMatchId.get(match.id) ?? []}
                  tournamentName={tournamentNamesById.get(match.tournamentId)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[#ccd3e0] py-16 text-center text-sm font-semibold text-[#7c86a0]">예정된 경기가 없습니다.</p>
          )}
        </section>
        <HomeMatchCalendar initialMonthKey={calendarMonthKey} matches={calendarMatches} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_0.95fr]">
        <StandingsTable rows={standingRows} />
        <FormTable rows={standingRows} />
        <AdPlaceholder className="min-h-[300px]" />
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.95fr)]">
        <section aria-labelledby="recent-matches-title">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="recent-matches-title" className="text-lg font-black text-[#111827]">최근 종료 경기</h2>
            <Link href="/schedule" className="text-xs font-bold text-[#7c86a0] transition hover:text-[#4f46e5]">
              전체 보기 <span aria-hidden="true">&gt;</span>
            </Link>
          </div>
          {recentMatches.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {recentMatches.map((match) => (
                <RecentMatchCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.teamAId)}
                  teamB={teamsById.get(match.teamBId)}
                  tournamentName={tournamentNamesById.get(match.tournamentId)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[#ccd3e0] py-12 text-center text-sm font-semibold text-[#7c86a0]">최근 종료 경기가 없습니다.</p>
          )}
        </section>
        <AiSummaryPlaceholder />
      </section>

      <section className="grid gap-6 border-t border-[#edf0f5] pt-6 lg:grid-cols-[0.85fr_1fr]">
        <VideoSection videos={latestVideos} teamsById={teamsById} />
        <TeamShortcutGrid teams={lckTeams} />
      </section>

      <AdPlaceholder compact />
    </main>
  );
}
