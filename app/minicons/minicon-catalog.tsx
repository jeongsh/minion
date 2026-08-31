"use client";

import { CalendarDays, Images, Tags, UserRound } from "lucide-react";

import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import type { MiniconPack } from "@/lib/minicons/types";

function formatPublishedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function PackDetail({ pack }: { pack: MiniconPack }) {
  const publishedDate = formatPublishedDate(pack.publishedAt ?? null);
  const creatorName = pack.creatorName ?? (pack.isOfficial ? "MINION 운영팀" : "커뮤니티 제작자");
  const tags = pack.tags ?? [pack.isOfficial ? "공식" : "사용자 제작", "미니콘"];

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 sm:grid-cols-[152px_minmax(0,1fr)] sm:items-start" aria-label={`${pack.name} 정보`}>
        <div className="mx-auto aspect-square w-full max-w-[180px] overflow-hidden rounded-xl bg-[var(--ui-surface-muted)] sm:mx-0 sm:max-w-none">
          {/* 공개 버킷의 사용자 콘텐츠라 Next 이미지 호스트를 사전 열거할 수 없다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pack.coverUrl} alt={`${pack.name} 대표 미니콘`} className="h-full w-full object-cover" />
        </div>

        <div className="min-w-0">
          <h3 className="text-[18px] font-bold text-[var(--ui-ink)]">{pack.name}</h3>
          <p className="mt-2 text-[16px] font-normal leading-6 text-[var(--ui-text)]">
            {pack.description || "미니콘 패키지입니다."}
          </p>

          <dl className="mt-4 grid gap-2.5 text-[14px] font-normal text-[var(--ui-muted)]">
            <div className="flex min-w-0 items-center gap-2">
              <UserRound size={16} aria-hidden="true" className="shrink-0" />
              <dt className="shrink-0">제작자</dt>
              <dd className="truncate font-medium text-[var(--ui-ink)]">{creatorName}</dd>
            </div>
            {publishedDate ? (
              <div className="flex items-center gap-2">
                <CalendarDays size={16} aria-hidden="true" className="shrink-0" />
                <dt>공개일</dt>
                <dd className="font-medium text-[var(--ui-ink)]">{publishedDate}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Images size={16} aria-hidden="true" className="shrink-0" />
              <dt>구성</dt>
              <dd className="font-medium text-[var(--ui-ink)]">미니콘 {pack.items.length}개</dd>
            </div>
            <div className="flex items-start gap-2">
              <Tags size={16} aria-hidden="true" className="mt-1 shrink-0" />
              <dt className="mt-0.5 shrink-0">태그</dt>
              <dd className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-medium text-[var(--ui-text)]">
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby={`minicon-items-${pack.id}`}>
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-[var(--ui-border)] pb-2">
          <h3 id={`minicon-items-${pack.id}`} className="text-[18px] font-bold text-[var(--ui-ink)]">포함된 미니콘</h3>
          <span className="text-[13px] font-normal text-[var(--ui-muted)]">총 {pack.items.length}개</span>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label={`${pack.name} 미니콘 전체 목록`}>
          {pack.items.map((item) => (
            <li key={item.id} className="min-w-0">
              <div className="aspect-square overflow-hidden rounded-lg bg-[var(--ui-surface-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </div>
              <p className="mt-1 truncate text-center text-[13px] font-normal text-[var(--ui-muted)]">{item.name}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function MiniconCatalog({ packs }: { packs: MiniconPack[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,152px))] justify-start gap-x-2.5 gap-y-3">
      {packs.map((pack) => (
        <AdaptiveDialog
          key={pack.id}
          title={`${pack.name} 정보`}
          triggerAriaLabel={`${pack.name} 상세 보기`}
          triggerClassName="group min-w-0 rounded-lg p-1.5 text-left outline-none transition hover:bg-[var(--ui-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--tp)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-background)]"
          panelClassName="sm:max-w-[760px]"
          trigger={(
            <>
              <span className="block aspect-square overflow-hidden rounded-md bg-[var(--ui-surface-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pack.coverUrl} alt={`${pack.name} 대표 미니콘`} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
              </span>
              <span className="block px-0.5 pt-1.5">
                <span className="block truncate text-[15px] font-bold text-[var(--ui-ink)]">{pack.name}</span>
                <span className="mt-0.5 block text-[13px] font-normal text-[var(--ui-muted)]">미니콘 {pack.items.length}개</span>
              </span>
            </>
          )}
        >
          <PackDetail pack={pack} />
        </AdaptiveDialog>
      ))}
    </div>
  );
}
