import type { Metadata } from "next";
import Link from "next/link";
import { TransferMarketView } from "@/components/transfers/transfer-market";
import { getAllTeams } from "@/lib/data/lck";
import { getCachedTransferMarket } from "@/lib/transfers/data";
import { marketEvents, transferMarketUpdatedAt, transferSeason, type TransferMarket } from "@/lib/transfers/types";
import { recentTransferEvents, transferEventHeadline } from "@/lib/transfers/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { siteBaseUrl } from "@/lib/site";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { isCurrentUserAdmin } from "@/lib/auth/admin";

// 두 검색어와 스토브리그 연도, 다음 시즌 로스터를 함께 설명한다.
export function generateMetadata(): Metadata {
  const season = transferSeason();
  const title = `LCK 이적시장 실시간: ${season} LCK 스토브리그와 ${season + 1} 로스터 - MINION`;
  const description = `${season} LCK 스토브리그 이적시장을 루머까지 실시간으로 업데이트합니다. 팀별 ${season + 1} 로스터, 오피셜 이적·재계약·FA와 거피셜·루머·찌라시 소식을 출처와 함께 확인하세요.`;
  return {
    title,
    description,
    keywords: ["LCK 이적시장", "LCK 이적시장 실시간", "LCK 스토브리그", `${season + 1} LCK 로스터`, "LCK 찌라시", "LCK 이적 루머", "LCK 루머", "LCK FA", "롤 이적시장"],
    alternates: { canonical: "/transfers", types: { "application/rss+xml": [{ url: "/transfers/feed.xml", title: "MINION LCK 이적시장 실시간 소식" }] } },
    openGraph: { title, description, url: "/transfers", type: "website", images: ["/images/minion-og-20260829.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/images/minion-og-20260829.png"] },
  };
}

export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const params = await searchParams;
  const requested = Number(params.season);
  const season = Number.isInteger(requested) && requested >= 2026 && requested <= transferSeason() ? requested : transferSeason();
  const [market, teams, followedTeamIds, admin] = await Promise.all([getCachedTransferMarket(season), getAllTeams(), getFollowedTeamIds(), isCurrentUserAdmin()]);
  return <main className="layout-wide min-w-0 pb-16 pt-5 sm:pt-7 text-[var(--ui-ink)]">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3"><h1 className="home-section-title text-[20px] leading-7 font-normal sm:text-[28px] sm:leading-[42px]">LCK 이적시장과 스토브리그</h1>{admin && <Link href={`/admin/transfers?season=${season}`} className="rounded-lg bg-[var(--ui-card-bg)] px-3 py-2 text-sm font-medium">이적시장 관리</Link>}</header>
    {market && <JsonLd data={transferMarketJsonLd(market)} />}
    {market ? <TransferMarketView market={market} teams={teams} followedTeamIds={followedTeamIds} /> : <p className="rounded-xl bg-[var(--ui-card-bg)] p-8 text-center text-base font-normal text-[var(--ui-muted)]">이적시장 소식을 준비하고 있습니다.</p>}
  </main>;
}

/** 화면에는 보이지 않는 구조화 데이터. 최종 갱신 시각과 최근 이적·루머 목록을 검색엔진에 알린다. */
function transferMarketJsonLd(market: TransferMarket) {
  const baseUrl = siteBaseUrl();
  const url = `${baseUrl}/transfers`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `LCK 이적시장 실시간 ${market.season} 스토브리그`,
    description: `${market.season} LCK 스토브리그 오피셜·거피셜·루머 이적 소식과 팀별 ${market.season + 1} 로스터`,
    url,
    inLanguage: "ko-KR",
    dateModified: transferMarketUpdatedAt(market),
    isPartOf: { "@type": "WebSite", name: "MINION", url: baseUrl },
    about: { "@type": "SportsOrganization", name: "LCK", sport: "League of Legends" },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: recentTransferEvents(marketEvents(market), 30).map(({ event }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: transferEventHeadline(event),
      })),
    },
  };
}
