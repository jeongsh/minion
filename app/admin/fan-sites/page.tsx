import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getTeams } from "@/lib/data/lck";

export default async function AdminFanSitesPage() {
  const teams = await getTeams();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "팬 사이트 설정" }]} />
        <SectionHeader title="팬 사이트 설정" />
      </div>
      <DataTable
        rows={teams}
        columns={[
          { key: "host", label: "팬사이트 호스트", render: (row) => row.fanSiteHost },
          { key: "slug", label: "내부 라우트", render: (row) => `/fan/${row.slug}` },
          { key: "primary", label: "primary", render: (row) => row.primaryColor },
          { key: "secondary", label: "secondary", render: (row) => row.secondaryColor },
        ]}
      />
    </main>
  );
}
