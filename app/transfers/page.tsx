import type { Metadata } from "next";
import Link from "next/link";
import { TransferMarketView } from "@/components/transfers/transfer-market";
import { getPlayers, getAllTeams } from "@/lib/data/lck";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferSeason } from "@/lib/transfers/types";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { isCurrentUserAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "LCK 이적시장 | MINION", description: "LCK 팀별 다음 시즌 로스터, 선수 이적과 해외 진출, 재계약 및 FA 현황을 확인하세요." };

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
