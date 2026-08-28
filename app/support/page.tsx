import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { SupportBoardList } from "@/components/support/support-board-list";
import { listSupportBoard } from "@/lib/data/support";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "고객센터",
  description: "MINION 이용 중 궁금한 점이나 불편사항을 문의할 수 있는 고객센터 게시판입니다.",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const board = await listSupportBoard(Number.parseInt(page ?? "1", 10) || 1);

  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-4xl pb-20 pt-6 sm:pt-10">
        <PageHeader title="고객센터" />
        <div className="mt-8">
          <SupportBoardList board={board} />
        </div>
      </div>
    </main>
  );
}
