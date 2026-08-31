import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { getPublishedMiniconPacks } from "@/lib/data/minicons";

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

        <nav aria-label="미니콘 메뉴" className="mt-3 flex min-h-10 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="flex h-8 shrink-0 items-center px-2.5 text-[14px] font-medium text-[var(--accent)]">전체 미니콘</span>
          <Link href="/me/minicons" className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-[14px] font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">
            <Settings size={16} aria-hidden="true" /> 내 미니콘
          </Link>
          <Link href="/minicons/apply" className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-[14px] font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">
            <Plus size={16} aria-hidden="true" /> 미니콘 신청
          </Link>
          <span className="ml-auto shrink-0 px-2 text-[13px] font-normal text-[var(--ui-muted)]">총 {packs.length}개</span>
        </nav>

        <section className="mt-5" aria-label="공개 미니콘 목록">

          {packs.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,152px))] justify-start gap-x-2.5 gap-y-3">
              {packs.map((pack) => (
                <article key={pack.id} className="min-w-0 rounded-lg p-1.5 transition hover:bg-[var(--ui-surface-muted)]">
                  <div className="aspect-square overflow-hidden rounded-md bg-[var(--ui-surface-muted)]">
                    {/* 공개 버킷의 사용자 콘텐츠라 Next 이미지 호스트를 사전 열거할 수 없다. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pack.coverUrl} alt={`${pack.name} 대표 미니콘`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </div>
                  <div className="px-0.5 pt-1.5">
                    <h2 className="truncate text-[15px] font-bold text-[var(--ui-ink)]">{pack.name}</h2>
                    <p className="mt-0.5 text-[13px] font-normal text-[var(--ui-muted)]">미니콘 {pack.items.length}개</p>
                  </div>
                </article>
              ))}
            </div>
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
