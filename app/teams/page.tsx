import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getSets, getTeams } from "@/lib/data/lck";
import { buildTeamStandingRows, formatDateTime, teamLabel } from "@/lib/view-data";

export default async function TeamsPage() {
  const [teams, matches, sets] = await Promise.all([getTeams(), getMatches(), getSets()]);
  const standings = buildTeamStandingRows(teams, matches, sets);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="팀" title="LCK 허브 팀 목록" />

      <section className="flex flex-col gap-4" aria-labelledby="team-standings">
        <h2 id="team-standings" className="text-xl font-semibold">
          팀 순위
        </h2>
        <DataTable
          rows={standings}
          columns={[
            { key: "rank", label: "순위", render: (row) => row.rank },
            {
              key: "team",
              label: "팀명",
              render: (row) => (
                <Link href={`/teams/${row.team.slug}`} className="font-semibold">
                  {row.team.name}
                </Link>
              ),
            },
            { key: "shortName", label: "약칭", render: (row) => row.team.shortName },
            { key: "match", label: "매치 전적", render: (row) => row.matchRecord },
            { key: "set", label: "세트 전적", render: (row) => row.setRecord },
            { key: "rate", label: "승률", render: (row) => row.winRate },
            { key: "diff", label: "세트 득실", render: (row) => row.setDiff },
            { key: "recent", label: "최근 5경기", render: (row) => row.recent },
            {
              key: "next",
              label: "다음 경기",
              render: (row) =>
                row.nextMatch
                  ? `${formatDateTime(row.nextMatch.matchDate)} · ${teamLabel(teams, row.nextMatch.teamAId)} vs ${teamLabel(teams, row.nextMatch.teamBId)}`
                  : "-",
            },
            {
              key: "link",
              label: "이동",
              render: (row) => <Link href={`/teams/${row.team.slug}`}>팀 상세</Link>,
            },
          ]}
        />
      </section>
    </main>
  );
}
