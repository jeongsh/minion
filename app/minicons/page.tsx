import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { getPublishedMiniconPacks } from "@/lib/data/minicons";
import { MiniconCatalog } from "./minicon-catalog";
import { MiniconTabs } from "./minicon-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "미니콘 · MINION",
  description: "MINION 커뮤니티에서 사용할 미니콘을 둘러보고 내 목록을 설정하거나 새 미니콘을 신청합니다.",
};

export default async function MiniconsPage() {
  const packs = await getPublishedMiniconPacks();

  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-6xl pb-20 pt-6 sm:pt-10">
        <PageHeader title="미니콘" />

        <MiniconTabs active="catalog" />

        <section className="mt-5" aria-label="공개 미니콘 목록">
          <p className="mb-2 text-right text-[13px] font-normal text-[var(--ui-muted)]">총 {packs.length}개</p>
          {packs.length > 0 ? (
            <MiniconCatalog packs={packs} />
          ) : (
            <div className="rounded-lg bg-[var(--ui-surface-muted)] px-5 py-10 text-center">
              <p className="text-[16px] font-normal text-[var(--ui-muted)]">아직 공개된 미니콘이 없습니다.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
