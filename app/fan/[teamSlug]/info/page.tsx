import { DataTable } from "@/components/ui/data-table";
import { FanPageShell, FanSubpageHeader } from "@/components/fan/fan-page-shell";
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
    <FanPageShell>
      <FanSubpageHeader
        title="팀 정보"
        breadcrumbs={[{ label: team?.shortName ?? teamSlug.toUpperCase(), href: `/fan/${teamSlug}` }, { label: "팀 정보" }]}
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
