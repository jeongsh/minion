import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferSeason } from "@/lib/transfers/types";
import { TransferManager } from "./transfer-manager";

export const dynamic = "force-dynamic";

export default async function AdminTransfersPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const requested = Number((await searchParams).season);
  const season = Number.isInteger(requested) && requested >= 2026 && requested <= transferSeason() ? requested : transferSeason();
  const market = await getTransferMarket(season);
  return <main className="mx-auto w-full max-w-5xl px-[var(--page-inline)] py-8 text-[var(--ui-ink)]">
    <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "이적시장 관리" }]} />
    <header className="my-6 flex flex-wrap items-center justify-between gap-3"><h1 className="home-section-title text-[28px] font-normal">이적시장 관리</h1><Link href={`/transfers?season=${season}`} className="text-sm font-medium underline underline-offset-4">이적시장 보기</Link></header>
    <TransferManager key={season} market={market} season={season} />
  </main>;
}
