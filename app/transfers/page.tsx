import type { Metadata } from "next";
import Link from "next/link";
import { TransferMarketView } from "@/components/transfers/transfer-market";
import { getPlayers, getAllTeams } from "@/lib/data/lck";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferSeason } from "@/lib/transfers/types";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { isCurrentUserAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
// 검색 유입 키워드(LCK 이적시장·스토브리그·로스터·FA·찌라시)를 시즌 연도와 함께 노출한다.
export function generateMetadata(): Metadata {
  const season = transferSeason();
  const title = `LCK 이적시장 ${season} 스토브리그 - ${season + 1} 로스터·FA·찌라시 정리 | MINION`;
  const description = `${season} LCK 스토브리그 이적시장을 실시간으로 정리합니다. 팀별 ${season + 1} 로스터, 오피셜 이적·재계약·FA 현황과 보도(거피셜)·루머 소식을 한눈에 확인하세요.`;
  return {
    title,
    description,
    keywords: ["LCK 이적시장", "LCK 스토브리그", `${season + 1} LCK 로스터`, "LCK 찌라시", "LCK 이적 루머", "LCK FA", "롤 이적시장"],
    alternates: { canonical: "/transfers" },
    openGraph: { title, description, url: "/transfers", type: "website", images: ["/images/minion-og-20260829.png"] },
  };
}

export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const params = await searchParams;
  const requested = Number(params.season);
  const season = Number.isInteger(requested) && requested >= 2026 && requested <= transferSeason() ? requested : transferSeason();
  const [market, teams, players, followedTeamIds, admin] = await Promise.all([getTransferMarket(season), getAllTeams(), getPlayers(), getFollowedTeamIds(), isCurrentUserAdmin()]);
  return <main className="layout-wide min-w-0 pb-16 pt-5 sm:pt-7 text-[var(--ui-ink)]">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3"><h1 className="home-section-title text-[20px] leading-7 font-normal sm:text-[28px] sm:leading-[42px]">이적시장</h1>{admin && <Link href={`/admin/transfers?season=${season}`} className="rounded-lg bg-[var(--ui-card-bg)] px-3 py-2 text-sm font-medium">이적시장 관리</Link>}</header>
    {market ? <TransferMarketView market={market} teams={teams} players={players} followedTeamIds={followedTeamIds} /> : <p className="rounded-xl bg-[var(--ui-card-bg)] p-8 text-center text-base font-normal text-[var(--ui-muted)]">이적시장 소식을 준비하고 있습니다.</p>}
  </main>;
}
