import Link from "next/link";
import { SourceNotice } from "@/components/domain/source-notice";
import {
  getAllTeams,
  getFanMatchPredictions,
  getHubCommunityPosts,
  getLatestTeamVideos,
  getMatches,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import { teams as themeTeams } from "@/lib/team-themes";
import type { CommunityPost, FanMatchPrediction, Team, TeamVideo } from "@/lib/types";
import { formatDateTime, matchHref } from "@/lib/view-data";
import type { Match } from "@/lib/types";

// ── 예정 경기 프리뷰 카드 ─────────────────────────────────────

type StandingRow = {
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  winRate: number | null;
};

function MatchPreviewCard({
  match,
  teamA,
  teamB,
  standingA,
  standingB,
  predictions,
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  standingA?: StandingRow;
  standingB?: StandingRow;
  predictions: FanMatchPrediction[];
}) {
  const isLive = match.status === "live";

  const teamACount = predictions.filter((p) => p.teamId === match.teamAId).length;
  const teamBCount = predictions.filter((p) => p.teamId === match.teamBId).length;
  const voteTotal = teamACount + teamBCount;
  const probA = voteTotal > 0 ? Math.round((teamACount / voteTotal) * 100) : 50;
  const probB = voteTotal > 0 ? 100 - probA : 50;
  const favorA = voteTotal > 0 ? teamACount >= teamBCount : null;

  return (
    <Link
      href={matchHref(match)}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#e8eaf0] bg-white transition-all hover:border-[#c7cbda] hover:shadow-md"
    >
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between border-b border-[#f0f2f5] px-4 py-3">
        <span className="text-xs font-semibold text-[#98a2b3]">
          {formatDateTime(match.matchDate)}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
          isLive ? "bg-red-50 text-red-500" : "bg-[#f0f2f5] text-[#667085]"
        }`}>
          {isLive ? "● LIVE" : match.bestOf ? `BO${match.bestOf}` : "예정"}
        </span>
      </div>

      {/* 팀 대전 */}
      <div className="flex flex-1 flex-col items-center gap-5 px-4 py-7">
        {/* 팀 A */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f8f9fc] p-2">
            {teamA?.logoUrl ? (
              <img src={teamA.logoUrl} alt={teamA.name} className="h-full w-full object-contain transition-transform group-hover:scale-105" />
            ) : (
              <span className="text-lg font-black text-[#98a2b3]">{teamA?.shortName?.slice(0, 3) ?? "?"}</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-base font-black text-[#111827]">{teamA?.shortName ?? "-"}</p>
            {standingA && (
              <p className="text-[11px] text-[#98a2b3]">
                {standingA.rank}위 · {standingA.wins}승 {standingA.losses}패
              </p>
            )}
          </div>
        </div>

        <span className="text-sm font-black text-[#d0d5dd]">vs</span>

        {/* 팀 B */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f8f9fc] p-2">
            {teamB?.logoUrl ? (
              <img src={teamB.logoUrl} alt={teamB.name} className="h-full w-full object-contain transition-transform group-hover:scale-105" />
            ) : (
              <span className="text-lg font-black text-[#98a2b3]">{teamB?.shortName?.slice(0, 3) ?? "?"}</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-base font-black text-[#111827]">{teamB?.shortName ?? "-"}</p>
            {standingB && (
              <p className="text-[11px] text-[#98a2b3]">
                {standingB.rank}위 · {standingB.wins}승 {standingB.losses}패
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 승자예측 */}
      <div className="border-t border-[#f0f2f5] bg-[#f8f9fc] px-4 py-4">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-[11px] font-black text-[#667085]">승자예측</span>
          {voteTotal > 0 ? (
            <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-black text-accent">
              {favorA ? teamA?.shortName : teamB?.shortName} {favorA ? probA : probB}%
            </span>
          ) : (
            <span className="ml-auto text-[10px] font-semibold text-[#98a2b3]">투표 모집 중</span>
          )}
        </div>

        <div className="flex overflow-hidden rounded-full">
          <div
            className={`h-2 rounded-l-full transition-all ${voteTotal > 0 && favorA ? "bg-accent" : voteTotal > 0 ? "bg-[#d0d5dd]" : "bg-[#e4e7ec]"}`}
            style={{ width: `${probA}%` }}
          />
          <div
            className={`h-2 rounded-r-full transition-all ${voteTotal > 0 && !favorA ? "bg-accent" : voteTotal > 0 ? "bg-[#d0d5dd]" : "bg-[#e4e7ec]"}`}
            style={{ width: `${probB}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className={`text-[11px] font-black ${favorA ? "text-accent" : "text-[#98a2b3]"}`}>
            {teamA?.shortName} {voteTotal > 0 ? `${probA}%` : "-"}
          </span>
          <span className="text-[10px] font-semibold text-[#98a2b3]">
            {voteTotal > 0 ? `${voteTotal.toLocaleString("ko-KR")}표` : ""}
          </span>
          <span className={`text-[11px] font-black ${favorA === false ? "text-accent" : "text-[#98a2b3]"}`}>
            {voteTotal > 0 ? `${probB}%` : "-"} {teamB?.shortName}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── 미니 캘린더 ───────────────────────────────────────────────

function MiniCalendar({ matches }: { matches: Match[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const matchDays = new Set(
    matches
      .filter((m) => {
        const d = new Date(m.matchDate);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((m) => new Date(m.matchDate).getDate()),
  );

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(today);

  return (
    <div className="rounded-xl border border-[#e8eaf0] bg-white p-4">
      <p className="mb-3 text-center text-sm font-black text-[#111827]">{monthLabel}</p>
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="pb-1 text-[10px] font-bold text-[#98a2b3]">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate();
          const hasMatch = day != null && matchDays.has(day);
          const col = i % 7;
          const colorCls =
            day == null
              ? ""
              : isToday
                ? "bg-accent text-white font-black"
                : col === 0
                  ? "text-red-400 font-semibold"
                  : col === 6
                    ? "text-blue-400 font-semibold"
                    : "text-[#111827]";
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${colorCls}`}
              >
                {day ?? ""}
              </span>
              <span
                className={`h-1 w-1 rounded-full transition-opacity ${
                  hasMatch ? "bg-accent opacity-100" : "opacity-0"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 팀 팬사이트 카드 ───────────────────────────────────────────

function TeamFanCard({ team, rank }: { team: Team; rank?: number }) {
  const themeTeam = themeTeams.find((t) => t.id === team.id);
  const fanSlug = themeTeam?.fanSiteHost ?? team.slug;

  return (
    <Link
      href={`/fan/${fanSlug}`}
      className="group relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl p-5 transition-all hover:brightness-110 hover:shadow-md"
      style={{ backgroundColor: team.primaryColor, minHeight: "210px" }}
    >
      {/* 배경 그라디언트 */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0.30) 100%)`,
        }}
      />

      {/* 순위 뱃지 */}
      {rank != null && (
        <span className="absolute left-2.5 top-2.5 text-[10px] font-black text-white/50">
          #{rank}
        </span>
      )}

      {/* 로고 (흰 원 배경) */}
      <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt={team.name}
            className="h-10 w-10 object-contain"
          />
        ) : (
          <span
            className="text-sm font-black"
            style={{ color: team.primaryColor }}
          >
            {team.shortName.slice(0, 3)}
          </span>
        )}
      </div>

      {/* 팀명 */}
      <span className="relative text-sm font-black text-white">{team.shortName}</span>

      {/* 호버 안내 */}
      <span className="absolute bottom-2.5 left-0 right-0 text-center text-[10px] font-semibold text-white/0 transition-all group-hover:text-white/80">
        팬페이지 바로가기
      </span>
    </Link>
  );
}

// ── 소식 카드 (영상) ──────────────────────────────────────────

function NewsVideoCard({ video, team }: { video: TeamVideo; team?: Team }) {
  const thumb =
    video.thumbnailUrl ??
    (video.youtubeVideoId
      ? `https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`
      : null);

  const publishedDate = video.publishedAt
    ? new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(
        new Date(video.publishedAt),
      )
    : null;

  return (
    <a
      href={video.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-xl border border-[#e8eaf0] bg-white p-3 transition-all hover:border-[#c7cbda] hover:shadow-sm"
    >
      {/* 썸네일 */}
      <div className="relative h-[62px] w-[110px] shrink-0 overflow-hidden rounded-lg bg-[#f0f2f5]">
        {thumb ? (
          <img src={thumb} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl text-[#d0d5dd]">
            ▶
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
          <span className="scale-0 text-xl text-white drop-shadow transition-transform group-hover:scale-100">▶</span>
        </span>
      </div>

      {/* 텍스트 */}
      <div className="flex min-w-0 flex-col justify-between gap-1 py-0.5">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#111827] group-hover:text-accent">
          {video.title}
        </p>
        <div className="flex items-center gap-1.5">
          {team?.logoUrl ? (
            <img src={team.logoUrl} alt={team.shortName} className="h-4 w-4 object-contain" />
          ) : null}
          <span className="text-[11px] font-semibold text-[#98a2b3]">
            {team?.shortName ?? "LCK"}
          </span>
          {publishedDate && (
            <>
              <span className="text-[#d0d5dd]">·</span>
              <span className="text-[11px] text-[#98a2b3]">{publishedDate}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

// ── 공지 카드 ─────────────────────────────────────────────────

function NoticeCard({ post }: { post: CommunityPost }) {
  const date = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(
    new Date(post.createdAt),
  );
  return (
    <Link
      href={`/community/${post.boardType}/${post.id}`}
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f4f5f8]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-black text-accent">
          공지
        </span>
        <span className="truncate text-sm font-semibold text-[#111827]">{post.title}</span>
      </div>
      <span className="shrink-0 text-xs text-[#98a2b3]">{date}</span>
    </Link>
  );
}

// ── 페이지 ────────────────────────────────────────────────────

export default async function HomePage() {
  const [teams, matches, savedStandings, tournaments, latestVideos, hubPosts] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getTeamStandings(),
    getTournaments(),
    getLatestTeamVideos(8),
    getHubCommunityPosts(5),
  ]);

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const upcomingMatches = matches
    .filter((m) => m.status !== "completed")
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    .slice(0, 4);

  const predictionEntries = await Promise.all(
    upcomingMatches.map(async (match) => [match.id, await getFanMatchPredictions(match.id)] as const),
  );
  const predictionsByMatchId = new Map(predictionEntries);

  const latestSeason =
    tournaments.length > 0 ? Math.max(...tournaments.map((t) => t.season)) : 2026;
  const seasonTournamentIds = new Set(
    tournaments.filter((t) => t.season === latestSeason).map((t) => t.id),
  );
  const savedForSeason = savedStandings.filter((s) => seasonTournamentIds.has(s.tournamentId));
  const standingRows = savedForSeason
    .map((s) => {
      const team = teamMap.get(s.teamId);
      if (!team) return null;
      return {
        rank: s.rank,
        team,
        teamId: s.teamId,
        wins: s.wins,
        losses: s.losses,
        matchRecord: `${s.wins}-${s.losses}`,
        winRate: s.winRate,
        winRateLabel: s.winRate != null ? `${Math.round(s.winRate * 100)}%` : "-",
        setDiff: s.setDiff > 0 ? `+${s.setDiff}` : `${s.setDiff}`,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.rank - b.rank);

  // TeamId → standing 맵 (MatchPreviewCard용)
  const standingByTeamId = new Map(standingRows.map((r) => [r.teamId, r]));

  const rankedTeamIds = new Set(standingRows.map((r) => r.team.id));
  const lckTeams = [
    ...standingRows.map((r) => r.team),
    ...teams.filter((t) => t.isLckTeam && t.isActive !== false && !rankedTeamIds.has(t.id)),
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-5 py-8">

      {/* ── 예정 경기 프리뷰 ────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-black text-[#111827]">예정 경기</h2>
          <Link href="/schedule" className="text-xs font-semibold text-[#98a2b3] hover:text-accent">
            전체 일정 →
          </Link>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_220px]">
          {upcomingMatches.length === 0 ? (
            <p className="rounded-xl border border-[#e8eaf0] bg-white p-8 text-center text-sm text-[#98a2b3]">
              예정된 경기가 없습니다.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {upcomingMatches.map((match) => (
                <MatchPreviewCard
                  key={match.id}
                  match={match}
                  teamA={teamMap.get(match.teamAId)}
                  teamB={teamMap.get(match.teamBId)}
                  standingA={standingByTeamId.get(match.teamAId)}
                  standingB={standingByTeamId.get(match.teamBId)}
                  predictions={predictionsByMatchId.get(match.id) ?? []}
                />
              ))}
            </div>
          )}
          <MiniCalendar matches={matches} />
        </div>
      </section>

      {/* ── 순위 + 팀 팬페이지 ─────────────────────────────── */}
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">

        {/* 팀 팬페이지 그리드 */}
        {lckTeams.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-black text-[#111827]">LCK 팀</h2>
              <Link href="/teams" className="text-xs font-semibold text-[#98a2b3] hover:text-accent">
                전체 보기 →
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-2.5">
              {lckTeams.map((team) => {
                const row = standingRows.find((r) => r.team.id === team.id);
                return (
                  <TeamFanCard key={team.id} team={team} rank={row?.rank} />
                );
              })}
            </div>
          </section>
        )}

        {/* 순위표 */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black text-[#111827]">{latestSeason} LCK 순위</h2>
            <Link href="/standings" className="text-xs font-semibold text-[#98a2b3] hover:text-accent">
              전체 →
            </Link>
          </div>

          {standingRows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[#e8eaf0] bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0f2f5] bg-[#f8f9fc] text-left">
                    <th className="px-4 py-2.5 text-[11px] font-black text-[#98a2b3]">#</th>
                    <th className="px-3 py-2.5 text-[11px] font-black text-[#98a2b3]">팀</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-black text-[#98a2b3]">W-L</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-black text-[#98a2b3]">승률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {standingRows.map((row) => {
                    const isTop = row.rank <= 3;
                    const isBottom = row.rank > standingRows.length - 2;
                    return (
                      <tr
                        key={row.team.id}
                        className="transition-colors hover:bg-[#f8f9fc]"
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-sm font-black tabular-nums ${
                              isTop ? "text-accent" : isBottom ? "text-red-400" : "text-[#98a2b3]"
                            }`}
                          >
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/teams/${row.team.slug}`}
                            className="flex items-center gap-2 hover:text-accent"
                          >
                            {row.team.logoUrl ? (
                              <img
                                src={row.team.logoUrl}
                                alt=""
                                aria-hidden
                                className="h-5 w-5 shrink-0 object-contain"
                              />
                            ) : (
                              <span
                                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black"
                                style={{
                                  backgroundColor: `${row.team.primaryColor}20`,
                                  color: row.team.primaryColor,
                                }}
                              >
                                {row.team.shortName.slice(0, 2)}
                              </span>
                            )}
                            <span className="font-black text-[#111827]">{row.team.shortName}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#667085]">
                          {row.matchRecord}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#111827]">
                          {row.winRateLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-[#e8eaf0] bg-white p-8 text-center text-sm text-[#98a2b3]">
              순위 데이터가 없습니다.
            </p>
          )}
        </section>
      </div>

      {/* ── 전체 소식 ────────────────────────────────────────── */}
      {(latestVideos.length > 0 || hubPosts.length > 0) && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[15px] font-black text-[#111827]">전체 소식</h2>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* 최신 영상 */}
            {latestVideos.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#98a2b3]">
                  최신 영상
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {latestVideos.map((video) => (
                    <NewsVideoCard
                      key={video.id}
                      video={video}
                      team={teamMap.get(video.teamId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 공지사항 */}
            {hubPosts.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#98a2b3]">
                  공지사항
                </p>
                <div className="overflow-hidden rounded-xl border border-[#e8eaf0] bg-white py-1">
                  {hubPosts.map((post) => (
                    <NoticeCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <SourceNotice />
    </main>
  );
}
