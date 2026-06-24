import Link from "next/link";
import { HomeHeroSwiper } from "@/components/domain/home-hero-swiper";
import { HomeMatchCalendar, type HomeCalendarMatch } from "@/components/domain/home-match-calendar";
import {
  getAllTeams,
  getFanMatchPredictions,
  getHomeHeroSlides,
  getLatestTeamVideos,
  getMatches,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import { teams as themeTeams } from "@/lib/team-themes";
import type { FanMatchPrediction, Match, Team, TeamVideo } from "@/lib/types";
import { formatDateTime, formatTimeKST, matchHref } from "@/lib/view-data";

export const dynamic = "force-dynamic";

const TEAM_SHORTCUT_ORDER = ["T1", "GEN", "GENG", "HLE", "DK", "KT", "DRX", "NS", "FOX", "BRO", "KDF", "SOOP"];

type StandingRow = {
  team: Team;
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  setDiff: number;
  recent: Array<"W" | "L">;
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[#e8ecf5] bg-white ${className}`}>
      {children}
    </section>
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
    return <span className={`${sizeClass} rounded-xl bg-[#eef2f8]`} />;
  }

  return (
    <span className={`grid ${sizeClass} place-items-center ${plain ? "" : "rounded-xl bg-white"}`}>
      {team.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs font-black text-[#6b7280]">{team.shortName.slice(0, 3)}</span>
      )}
    </span>
  );
}

function votePercents(match: Match, predictions: FanMatchPrediction[]) {
  const left = predictions.filter((item) => item.teamId === match.teamAId).length;
  const right = predictions.filter((item) => item.teamId === match.teamBId).length;
  const total = left + right;

  if (total === 0) {
    return { left: 50, right: 50 };
  }

  const leftPercent = Math.round((left / total) * 100);
  return { left: leftPercent, right: 100 - leftPercent };
}

function matchTitle(match: Match, teamA?: Team, teamB?: Team) {
  const fallback = `${teamA?.shortName ?? "TBD"} vs ${teamB?.shortName ?? "TBD"}`;
  return match.name?.trim() || fallback;
}

function MatchPollCard({
  match,
  teamA,
  teamB,
  predictions,
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  predictions: FanMatchPrediction[];
}) {
  const percents = votePercents(match, predictions);
  const accent = teamA?.primaryColor || "#ff315d";

  return (
    <Link
      href={matchHref(match)}
      className="rounded-2xl border border-[#e7ebf3] bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <p className="text-xs font-semibold text-[#64708f]">{formatDateTime(match.matchDate)}</p>
      <p className="mt-2 line-clamp-1 text-center text-sm font-black text-[#111827]">
        {matchTitle(match, teamA, teamB)}
      </p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamLogo team={teamA} size="lg" />
          <span className="min-h-8 text-sm font-black leading-tight text-[#111827]">
            {teamA?.shortName ?? "TBD"}
          </span>
        </div>
        <span className="text-lg font-black text-[#111827]">VS</span>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamLogo team={teamB} size="lg" />
          <span className="min-h-8 text-sm font-black leading-tight text-[#111827]">
            {teamB?.shortName ?? "TBD"}
          </span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-sm font-black">
        <span>{percents.left}%</span>
        <span className="text-[#69738d]">{percents.right}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e3e7ef]">
        <div className="h-full rounded-full" style={{ width: `${percents.left}%`, backgroundColor: accent }} />
      </div>
    </Link>
  );
}

function dateKeyKST(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function yearMonthKeyKST(value: string) {
  return dateKeyKST(value).slice(0, 7);
}

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black text-[#111827]">LCK 순위</h2>
        <Link href="/standings" className="rounded-lg border border-[#e8ecf5] px-3 py-2 text-xs font-bold text-[#64708f]">
          전체 시즌
        </Link>
      </div>
      <div className="grid grid-cols-[40px_1fr_58px_62px_44px] border-b border-[#eef1f7] pb-2 text-xs font-black text-[#7c86a0]">
        <span>순위</span>
        <span>팀</span>
        <span className="text-right">승-패</span>
        <span className="text-right">득실차</span>
        <span className="text-right">연속</span>
      </div>
      <div className="divide-y divide-[#f1f4f8]">
        {rows.slice(0, 5).map((row) => (
          <Link
            href={`/teams/${row.team.slug}`}
            key={row.teamId}
            className="grid grid-cols-[40px_1fr_58px_62px_44px] items-center py-2 text-sm"
          >
            <span className="font-black text-[#111827]">{row.rank}</span>
            <span className="flex items-center gap-2 font-semibold text-[#64708f]">
              <TeamLogo team={row.team} size="sm" />
              {row.team.shortName}
            </span>
            <span className="text-right font-semibold text-[#64708f]">
              {row.wins}-{row.losses}
            </span>
            <span className="text-right font-semibold text-[#64708f]">{row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}</span>
            <span className="text-right font-semibold text-[#64708f]">{row.recent[0] ?? "-"}</span>
          </Link>
        ))}
      </div>
      <Link
        href="/standings"
        className="mx-auto mt-2 flex h-8 w-48 items-center justify-center rounded-full border border-[#e8ecf5] text-xs font-bold text-[#64708f]"
      >
        전체 순위 보기 {'>'}
      </Link>
    </Card>
  );
}

function FormTable({ rows }: { rows: StandingRow[] }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black text-[#111827]">팀 최근 폼</h2>
        <span className="rounded-lg border border-[#e8ecf5] px-3 py-2 text-xs font-bold text-[#64708f]">
          최근 5경기 기준
        </span>
      </div>
      <div className="grid grid-cols-[40px_1fr_118px] border-b border-[#eef1f7] pb-2 text-xs font-black text-[#7c86a0]">
        <span>순위</span>
        <span>팀</span>
        <span className="text-right">최근 5경기</span>
      </div>
      <div className="divide-y divide-[#f1f4f8]">
        {rows.slice(0, 5).map((row) => (
          <Link
            href={`/teams/${row.team.slug}`}
            key={row.teamId}
            className="grid grid-cols-[40px_1fr_118px] items-center py-2 text-sm"
          >
            <span className="font-black text-[#111827]">{row.rank}</span>
            <span className="flex items-center gap-2 font-semibold text-[#64708f]">
              <TeamLogo team={row.team} size="sm" />
              {row.team.shortName}
            </span>
            <span className="flex justify-end gap-1">
              {(row.recent.length > 0 ? row.recent : ["W", "W", "L", "W", "L"]).slice(0, 5).map((result, index) => (
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
      <Link
        href="/standings"
        className="mx-auto mt-2 flex h-8 w-48 items-center justify-center rounded-full border border-[#e8ecf5] text-xs font-bold text-[#64708f]"
      >
        전체 팀 보기 {'>'}
      </Link>
    </Card>
  );
}

function VideoSection({ videos, teamsById }: { videos: TeamVideo[]; teamsById: Map<string, Team> }) {
  if (videos.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-black text-[#111827]">추천 영상</h2>
        <div className="rounded-lg border border-dashed border-[#e8ecf5] bg-[#f8f9fc] px-4 py-10 text-center text-sm font-semibold text-[#64708f]">
          등록된 추천 영상이 없습니다.
        </div>
      </Card>
    );
  }

  const [mainVideo, ...sideVideos] = videos;

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-lg font-black text-[#111827]">추천 영상</h2>
      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <a
          href={mainVideo.videoUrl}
          className="group relative min-h-36 overflow-hidden rounded-lg bg-[#101322]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {mainVideo.thumbnailUrl ? (
            <img src={mainVideo.thumbnailUrl} alt={mainVideo.title} className="h-full w-full object-cover opacity-85" />
          ) : (
            <div className="grid h-full min-h-36 place-items-center bg-[#161b2d] text-sm font-bold text-white/70">No thumbnail</div>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <span className="absolute bottom-4 left-4 text-base font-black text-white">{mainVideo.title}</span>
          <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-black/35 text-white">
            ▶
          </span>
        </a>
        <div className="flex flex-col gap-3">
          {sideVideos.slice(0, 3).map((video) => {
            const team = teamsById.get(video.teamId);
            return (
              <a
                key={video.id}
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-[74px_1fr] gap-3"
              >
                <div className="relative h-12 overflow-hidden rounded-lg bg-[#eef2f8]">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-[#dfe4ee]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#64708f]">{video.title}</p>
                  {team ? <p className="mt-1 text-xs font-semibold text-[#a0a8bb]">{team.shortName}</p> : null}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </Card>
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
    <Card className="p-4">
      <h2 className="mb-3 text-lg font-black text-[#111827]">팀별 팬사이트 바로가기</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sortedTeams.slice(0, 10).map((team) => {
          const themeTeam = themeTeams.find((item) => item.id === team.id);
          const fanSlug = themeTeam?.fanSiteHost ?? team.slug;

          return (
            <Link
              key={team.id}
              href={`/fan/${fanSlug}`}
              className="group relative flex min-h-[104px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#d9dee8] bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-[#b9c1d0] hover:shadow-md"
            >
              <span className="relative grid h-[76px] w-[76px] place-items-center p-1.5">
                <TeamLogo team={team} size="xl" plain />
              </span>
              <span className="relative text-xs font-black text-[#111827]">{team.shortName}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}


function buildRecentForm(teamId: string, matches: Match[]) {
  return matches
    .filter((match) => match.status === "completed" && (match.teamAId === teamId || match.teamBId === teamId))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 5)
    .map((match) => (match.winnerTeamId === teamId ? "W" : "L") as "W" | "L");
}

export default async function HomePage() {
  const [teams, matches, savedStandings, tournaments, latestVideos, homeHeroSlides] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getTeamStandings(),
    getTournaments(),
    getLatestTeamVideos(4),
    getHomeHeroSlides({ limit: 8 }),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latestSeason = tournaments.length > 0 ? Math.max(...tournaments.map((tournament) => tournament.season)) : 2026;
  const latestTournamentIds = new Set(tournaments.filter((tournament) => tournament.season === latestSeason).map((tournament) => tournament.id));
  const standingRows = savedStandings
    .filter((standing) => latestTournamentIds.has(standing.tournamentId))
    .map((standing) => {
      const team = teamsById.get(standing.teamId);
      if (!team) return null;
      return {
        team,
        teamId: standing.teamId,
        rank: standing.rank,
        wins: standing.wins,
        losses: standing.losses,
        setDiff: standing.setDiff,
        recent: buildRecentForm(standing.teamId, matches),
      };
    })
    .filter((row): row is StandingRow => row !== null)
    .sort((a, b) => a.rank - b.rank);

  const rankedIds = new Set(standingRows.map((row) => row.teamId));
  const lckTeams = [
    ...standingRows.map((row) => row.team),
    ...teams.filter((team) => team.isLckTeam && team.isActive !== false && !rankedIds.has(team.id)),
  ];
  const upcomingMatches = matches
    .filter((match) => match.status !== "completed")
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    .slice(0, 2);
  const predictionEntries = await Promise.all(
    upcomingMatches.map(async (match) => [match.id, await getFanMatchPredictions(match.id)] as const),
  );
  const predictionsByMatchId = new Map(predictionEntries);
  const calendarMonthKey = upcomingMatches[0]?.matchDate ? yearMonthKeyKST(upcomingMatches[0].matchDate) : yearMonthKeyKST(new Date().toISOString());
  const calendarMatches = matches
    .filter((match) => yearMonthKeyKST(match.matchDate) === calendarMonthKey)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const calendarClientMatches: HomeCalendarMatch[] = calendarMatches.map((match) => {
    const teamA = teamsById.get(match.teamAId);
    const teamB = teamsById.get(match.teamBId);

    return {
      id: match.id,
      dateKey: dateKeyKST(match.matchDate),
      href: matchHref(match),
      time: formatTimeKST(match.matchDate),
      title: matchTitle(match, teamA, teamB),
      teams: `${teamA?.shortName ?? "TBD"} vs ${teamB?.shortName ?? "TBD"}`,
    };
  });
  const heroSlides = homeHeroSlides.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    alt: slide.title,
    href: slide.linkUrl,
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 pb-8 pt-6 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,2.35fr)_minmax(300px,0.85fr)]">
        <HomeHeroSwiper slides={heroSlides} />

        <Card className="relative overflow-hidden !bg-[#eef0ff] p-8">
          <div className="pointer-events-none absolute right-6 top-7 h-14 w-14 rounded-full bg-white/45 blur-sm" />
          <div className="pointer-events-none absolute right-9 top-20 h-5 w-5 rounded-full bg-[#ff7ab6]/70 shadow-[24px_30px_0_rgba(255,207,92,0.75),-18px_78px_0_rgba(255,163,201,0.7)]" />
          <div className="pointer-events-none absolute bottom-5 left-6 h-4 w-4 rounded-full bg-[#ffe48a]/80 shadow-[26px_-8px_0_rgba(177,162,255,0.8)]" />
          <div className="relative z-10">
          <span className="rounded-full border border-[#a9a3ff] bg-white/70 px-4 py-2 text-sm font-black text-[#6f63ff]">
            참여 이벤트
          </span>
          <h2 className="mt-8 text-3xl font-black leading-tight text-[#111827]">
            최근 경기
            <br />
            평점 투표 참여하기
          </h2>
          <p className="mt-6 max-w-[230px] text-sm font-semibold leading-6 text-[#59647c]">
            최근 경기의 플레이와 선수 활약을 직접 평가해주세요! 여러분의 한 표가 큰 힘이 됩니다.
          </p>
          <Link
            href="/schedule"
            className="mt-7 inline-flex h-12 items-center gap-3 rounded-full bg-[#101a3d] px-6 text-sm font-black text-white"
            style={{ color: "#ffffff" }}
          >
            <span>평점 투표 참여하기</span>
            <span>›</span>
          </Link>
          </div>
          <div className="absolute bottom-0 right-0 z-0 hidden h-28 w-32 place-items-center rounded-tl-[36px] bg-white/45 text-xs font-black text-[#8a91a8] md:grid">
            캐릭터 이미지
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,0.9fr)]">
        <Card className="p-5">
          <h2 className="mb-4 text-xl font-black text-[#111827]">다가오는 경기</h2>
          {upcomingMatches.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {upcomingMatches.map((match) => (
                <MatchPollCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.teamAId)}
                  teamB={teamsById.get(match.teamBId)}
                  predictions={predictionsByMatchId.get(match.id) ?? []}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#ccd3e0] py-16 text-center text-sm font-semibold text-[#7c86a0]">
              예정된 경기가 없습니다.
            </p>
          )}
        </Card>
        <HomeMatchCalendar initialMonthKey={calendarMonthKey} matches={calendarClientMatches} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_0.95fr]">
        <StandingsTable rows={standingRows} />
        <FormTable rows={standingRows} />
        <div className="grid min-h-[300px] place-items-center rounded-2xl bg-[#e6e7eb] text-2xl font-black text-[#666]">
          광고영역
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1fr]">
        <VideoSection videos={latestVideos} teamsById={teamsById} />
        <TeamShortcutGrid teams={lckTeams} />
      </section>

      <div className="grid h-14 place-items-center rounded-xl bg-[#e6e7eb] text-2xl font-black text-[#666]">
        광고영역
      </div>
    </main>
  );
}
