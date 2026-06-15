import Link from "next/link";
import { MiniModalLink } from "@/components/domain/mini-modal-link";
import { SourceNotice } from "@/components/domain/source-notice";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getCommunityPosts, getFanRatings, getMatches, getPlayers, getSets, getTeams } from "@/lib/data/lck";
import {
  buildTeamStandingRows,
  fanPogSummaryForMatch,
  formatDateTime,
  matchSetScore,
  playerLabel,
  teamLabel,
  topFanRatingForMatch,
} from "@/lib/view-data";

export default async function HomePage() {
  const [teams, players, matches, sets, fanRatings, communityPosts] = await Promise.all([
    getTeams(),
    getPlayers(),
    getMatches(),
    getSets(),
    getFanRatings(),
    getCommunityPosts(),
  ]);
  const upcomingMatches = matches.filter((match) => match.status !== "completed").slice(0, 2);
  const weeklyMatches = matches.slice(0, 5);
  const recentResults = matches.filter((match) => match.status === "completed");
  const standings = buildTeamStandingRows(teams, matches, sets);
  const popularReviews = communityPosts
    .filter((post) => post.boardType === "reviews")
    .sort((a, b) => b.commentCount + b.likeCount - (a.commentCount + a.likeCount));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="LCK" title="LCK 경기, 순위, 팬 데이터 허브" />

      <section className="flex flex-col gap-4" aria-labelledby="today-matches">
        <h2 id="today-matches" className="text-xl font-semibold">
          예정 경기
        </h2>
        <div className="page-grid">
          {upcomingMatches.map((match) => (
            <article key={match.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">{formatDateTime(match.matchDate)}</p>
                  <h3 className="mt-2 text-lg font-semibold">{match.name}</h3>
                </div>
                <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
                  {match.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                <span>{teamLabel(teams, match.teamAId)}</span>
                <strong>vs</strong>
                <span className="text-right">{teamLabel(teams, match.teamBId)}</span>
              </div>
              <Link
                href={`/matches/${match.id}`}
                className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
              >
                경기 상세
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="weekly-schedule">
        <h2 id="weekly-schedule" className="text-xl font-semibold">
          경기 일정
        </h2>
        <DataTable
          rows={weeklyMatches}
          columns={[
            { key: "date", label: "일시", render: (row) => formatDateTime(row.matchDate) },
            {
              key: "match",
              label: "경기",
              render: (row) => (
                <MiniModalLink
                  href={`/matches/${row.id}`}
                  label={row.name}
                  eyebrow="경기"
                  title={row.name}
                  rows={[
                    { label: "스코어", value: `${row.teamAScore ?? "-"}:${row.teamBScore ?? "-"}` },
                    { label: "공식 POM", value: playerLabel(players, row.officialPomPlayerId) },
                  ]}
                  cta="경기 상세 보기"
                />
              ),
            },
            { key: "teams", label: "팀", render: (row) => `${teamLabel(teams, row.teamAId)} vs ${teamLabel(teams, row.teamBId)}` },
            { key: "status", label: "상태", render: (row) => row.status },
            { key: "link", label: "이동", render: (row) => <Link href={`/matches/${row.id}`}>상세</Link> },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="standings">
        <h2 id="standings" className="text-xl font-semibold">
          현재 순위
        </h2>
        <DataTable
          rows={standings.slice(0, 5)}
          columns={[
            { key: "rank", label: "순위", render: (row) => row.rank },
            { key: "team", label: "팀", render: (row) => <Link href={`/teams/${row.team.slug}`}>{row.team.name}</Link> },
            { key: "match", label: "매치 전적", render: (row) => row.matchRecord },
            { key: "set", label: "세트 전적", render: (row) => row.setRecord },
            { key: "rate", label: "승률", render: (row) => row.winRate },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="recent-results">
        <h2 id="recent-results" className="text-xl font-semibold">
          최근 경기 결과
        </h2>
        <DataTable
          rows={recentResults}
          columns={[
            { key: "match", label: "경기", render: (row) => row.name },
            { key: "score", label: "최종 스코어", render: (row) => `${row.teamAScore ?? "-"}:${row.teamBScore ?? "-"}` },
            { key: "sets", label: "세트", render: (row) => matchSetScore(row, sets, teams) },
            { key: "pom", label: "공식 POM", render: (row) => playerLabel(players, row.officialPomPlayerId) },
            { key: "rating", label: "팬 평점 1위", render: (row) => topFanRatingForMatch(row.id, fanRatings, players) },
            { key: "pog", label: "팬 POG", render: (row) => fanPogSummaryForMatch(row.id, sets) },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="popular-reviews">
        <h2 id="popular-reviews" className="text-xl font-semibold">
          인기 경기 리뷰
        </h2>
        <DataTable
          rows={popularReviews}
          columns={[
            { key: "title", label: "리뷰", render: (row) => row.title },
            { key: "content", label: "내용", render: (row) => row.content },
            { key: "comments", label: "댓글", render: (row) => row.commentCount },
            { key: "likes", label: "추천", render: (row) => row.likeCount },
          ]}
        />
      </section>

      <SourceNotice />
    </main>
  );
}
