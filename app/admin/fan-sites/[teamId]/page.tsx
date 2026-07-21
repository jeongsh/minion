import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { requireAdmin } from "@/lib/auth/admin";
import { getTeamById } from "@/lib/data/lck";
import { listFanHeaderRequests } from "@/lib/fan/fan-header-admin";

import { FanHeaderRequestRow } from "../../fan-headers/request-row";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  pending: "검토 대기",
  approved: "승인됨",
  rejected: "반려됨",
} as const;

export default async function AdminFanSiteTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  await requireAdmin();
  const { teamId } = await params;
  const [team, allRequests] = await Promise.all([getTeamById(teamId), listFanHeaderRequests()]);

  if (!team) notFound();

  const requests = allRequests.filter((request) => request.teamId === team.id);
  const groups = (["pending", "approved", "rejected"] as const).map((status) => ({
    status,
    items: requests.filter((request) => request.status === status),
  }));

  const settings = [
    { label: "팬사이트 호스트", value: team.fanSiteHost || "-" },
    { label: "팬사이트 라우트", value: `/fan/${team.slug}` },
    { label: "커뮤니티 라우트", value: `/fan/${team.slug}/community` },
    { label: "primary", value: team.primaryColor },
    { label: "secondary", value: team.secondaryColor },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Breadcrumb
            items={[
              { label: "관리자", href: "/admin" },
              { label: "팬사이트 관리", href: "/admin/fan-sites" },
              { label: team.name },
            ]}
          />
          <SectionHeader title={`팬사이트 관리 · ${team.name}`} />
        </div>
        <Link
          href="/admin/fan-sites"
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          목록으로
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <DataTable
          rows={settings}
          compact
          columns={[
            { key: "label", label: "항목", render: (row) => row.label },
            { key: "value", label: "값", render: (row) => row.value },
          ]}
        />
        <div
          className="flex min-h-36 flex-col justify-end rounded-xl border border-border p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.secondaryColor} 100%)` }}
        >
          {team.logoWhiteUrl || team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoWhiteUrl || team.logoUrl} alt="" className="mb-4 h-14 w-14 object-contain drop-shadow" />
          ) : null}
          <strong className="text-xl">{team.shortName}</strong>
          <span className="text-sm text-white/75">{team.fanSiteHost}</span>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">대문 변경 요청</h2>
          <p className="text-[13px] font-medium leading-[1.6] text-[var(--ui-muted)]">
            이 팀 팬사이트의 대문 후보만 검토합니다. 승인해도 바로 적용되지 않으며, 필요하면 투표 공지를 올린 뒤 결과를 보고 적용합니다.
          </p>
        </div>

        {groups.map((group) => (
          <div key={group.status} className="flex flex-col gap-3">
            <h3 className="text-[15px] font-black text-[var(--ui-ink)]">
              {STATUS_LABELS[group.status]} {group.items.length}건
            </h3>
            {group.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--ui-border)] px-4 py-6 text-center text-[13px] font-semibold text-[var(--ui-muted)]">
                없습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {group.items.map((request) => (
                  <FanHeaderRequestRow key={request.id} request={request} />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
