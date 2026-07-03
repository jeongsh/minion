import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/ui/data-table";
import { FanPageShell } from "@/components/fan/fan-page-shell";
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
    <FanPageShell eyebrow={`${team?.shortName ?? "Team"} Official`} title="팀 정보 / 공식 링크">
      <Breadcrumb
        items={[
          { label: team?.shortName ?? "팀", href: `/fan/${teamSlug}` },
          { label: "팀 정보 / 공식 링크" },
        ]}
      />
      <DataTable
        rows={rows}
        columns={[
          { key: "label", label: "항목", render: (row) => row.label },
          { key: "value", label: "링크", render: (row) => row.value },
        ]}
      />
    </FanPageShell>
  );
}
