import Link from "next/link";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { requireAdmin } from "@/lib/auth/admin";
import { getTeams } from "@/lib/data/lck";
import { listFanHeaderRequests } from "@/lib/fan/fan-header-admin";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

type FanSiteRow = Team & {
  pendingHeaderCount: number;
  approvedHeaderCount: number;
};

export default async function AdminFanSitesPage() {
  await requireAdmin();
  const [teams, requests] = await Promise.all([getTeams(), listFanHeaderRequests()]);

  const rows: FanSiteRow[] = teams.map((team) => {
    const teamRequests = requests.filter((request) => request.teamId === team.id);
    return {
      ...team,
      pendingHeaderCount: teamRequests.filter((request) => request.status === "pending").length,
      approvedHeaderCount: teamRequests.filter((request) => request.status === "approved").length,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "팬사이트 관리" }]} />
        <SectionHeader title="팬사이트 관리" />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">팀별 팬사이트</h2>
          <p className="text-sm text-muted">
            팬사이트 호스트, 공개 라우트, 대문 요청 등 팀별 팬사이트 운영 항목은 각 팀 관리 화면에서 처리합니다.
          </p>
        </div>
        <DataTable
          rows={rows}
          getRowHref={(row) => `/admin/fan-sites/${row.id}`}
          columns={[
            {
              key: "team",
              label: "팀",
              render: (row) => (
                <span className="inline-flex items-center gap-2">
                  {row.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.logoUrl} alt="" className="h-6 w-6 object-contain" />
                  ) : null}
                  <span className="font-semibold">{row.name}</span>
                </span>
              ),
            },
            { key: "host", label: "팬사이트 호스트", render: (row) => row.fanSiteHost || "-" },
            { key: "slug", label: "내부 라우트", render: (row) => `/fan/${row.slug}` },
            {
              key: "headerRequests",
              label: "대문 요청",
              render: (row) => `${row.pendingHeaderCount} 대기 / ${row.approvedHeaderCount} 승인`,
            },
            {
              key: "actions",
              label: "",
              headerClassName: "text-right",
              cellClassName: "text-right",
              render: (row) => (
                <Link
                  href={`/admin/fan-sites/${row.id}`}
                  className="relative z-20 rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold hover:bg-surface-muted"
                >
                  관리
                </Link>
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}
