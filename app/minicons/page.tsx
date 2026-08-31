import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { getPublishedMiniconPacks } from "@/lib/data/minicons";
import { MiniconCatalog } from "./minicon-catalog";

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

        <nav
          aria-label="미니콘 메뉴"
          className="tab-scroll -mx-[var(--layout-gutter)] mt-3 grid max-w-none grid-flow-col auto-cols-fr overflow-x-auto border-b border-[var(--ui-border)] bg-[var(--page-background)] md:mx-0 md:max-w-full md:gap-0.5 md:rounded-[10px] md:border-b-0 md:bg-[var(--ui-card-bg)] md:p-[3px]"
        >
          <span
            aria-current="page"
            className="flex h-9 min-w-[4.25rem] shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-[var(--accent)] px-2 text-[14px] font-medium text-[var(--ui-ink)] md:h-8 md:rounded-lg md:border md:border-[var(--ui-border)] md:bg-[var(--ui-surface)] md:dark:bg-[var(--ui-border)]"
          >
            전체 미니콘
          </span>
          <Link
            href="/me/minicons"
            className="flex h-9 min-w-[4.25rem] shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-2 text-[14px] font-medium text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)] md:h-8 md:rounded-lg"
          >
            내 미니콘
          </Link>
          <Link
            href="/minicons/apply"
            className="flex h-9 min-w-[4.25rem] shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-2 text-[14px] font-medium text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)] md:h-8 md:rounded-lg"
          >
            미니콘 신청
          </Link>
        </nav>

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
