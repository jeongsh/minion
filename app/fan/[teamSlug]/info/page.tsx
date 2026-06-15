import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getTeamByRouteKey } from "@/lib/team-themes";

export default async function FanInfoPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = getTeamByRouteKey(teamSlug);
  const rows = team
    ? [
        { label: "공식 홈페이지", value: team.officialHomepageUrl },
        { label: "유튜브", value: team.officialYoutubeUrl },
        { label: "X", value: team.officialXUrl },
        { label: "인스타그램", value: team.officialInstagramUrl },
      ]
    : [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader
        eyebrow={team?.shortName}
        title="팀 정보 / 공식 링크"
      />
      <DataTable
        rows={rows}
        columns={[
          { key: "label", label: "항목", render: (row) => row.label },
          { key: "value", label: "링크", render: (row) => row.value },
        ]}
      />
    </main>
  );
}
