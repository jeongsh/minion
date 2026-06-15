import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getPlayers, getTeams } from "@/lib/data/lck";
import { teamLabel } from "@/lib/view-data";

export default async function AdminPlayersPage() {
  const [players, teams] = await Promise.all([getPlayers(), getTeams()]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="선수 관리" />
      <DataTable
        rows={players}
        columns={[
          { key: "slug", label: "slug", render: (row) => row.slug },
          { key: "name", label: "선수명", render: (row) => row.name },
          { key: "team", label: "팀", render: (row) => teamLabel(teams, row.teamId) },
          { key: "position", label: "포지션", render: (row) => row.position },
        ]}
      />
    </main>
  );
}
