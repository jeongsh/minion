import { AdminPagination } from "@/components/admin/pagination";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getAdminRatingsPage } from "@/lib/data/lck";
import { formatFanRating } from "@/lib/fan-rating-display";

export default async function AdminRatingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const listPage = await getAdminRatingsPage(page);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "팬 평점 관리" }]} />
        <SectionHeader title="팬 평점 관리" />
      </div>
      <DataTable
        rows={listPage.rows}
        columns={[
          { key: "player", label: "선수", render: (row) => row.playerName },
          { key: "rating", label: "평점", render: (row) => formatFanRating(row.rating) },
          { key: "review", label: "리뷰", render: (row) => row.review },
          { key: "created", label: "작성일", render: (row) => new Date(row.createdAt).toLocaleDateString("ko-KR") },
        ]}
      />
      <AdminPagination pathname="/admin/ratings" {...listPage} />
    </main>
  );
}
