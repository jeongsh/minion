import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getFanRatings, getPlayers } from "@/lib/data/lck";
import { playerLabel } from "@/lib/view-data";

export default async function AdminRatingsPage() {
  const [fanRatings, players] = await Promise.all([getFanRatings(), getPlayers()]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="팬 평점 관리" />
      <DataTable
        rows={fanRatings}
        columns={[
          { key: "player", label: "선수", render: (row) => playerLabel(players, row.playerId) },
          { key: "rating", label: "평점", render: (row) => row.rating.toFixed(1) },
          { key: "review", label: "리뷰", render: (row) => row.review },
          { key: "created", label: "작성일", render: (row) => new Date(row.createdAt).toLocaleDateString("ko-KR") },
        ]}
      />
    </main>
  );
}
