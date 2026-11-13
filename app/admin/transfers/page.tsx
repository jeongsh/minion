import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferSeason } from "@/lib/transfers/types";
import { TransferManager } from "./transfer-manager";
import { createSupabaseAdminActionClient } from "@/lib/auth/admin";
import { getTransferTeams } from "@/lib/transfers/teams";
import { getAllPlayers } from "@/lib/data/lck";
import { normalizeTransferName } from "@/lib/transfers/types";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTransfersPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const requested = Number((await searchParams).season);
  const season = Number.isInteger(requested) && requested >= 2026 && requested <= transferSeason() ? requested : transferSeason();
  const client = await createSupabaseAdminActionClient();
  const [market, teams, players] = await Promise.all([getTransferMarket(season), getTransferTeams(client), getAllPlayers()]);
  return <main className="mx-auto w-full max-w-5xl px-[var(--page-inline)] py-8 text-[var(--ui-ink)]">
    <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "이적시장 관리" }]} />
    <header className="my-6 flex flex-wrap items-center justify-between gap-3"><h1 className="home-section-title text-[28px] font-normal">이적시장 관리</h1><Link href={`/transfers?season=${season}`} className="text-sm font-medium underline underline-offset-4">이적시장 보기</Link></header>
    <TransferManager key={season} market={market} season={season} teams={teams} players={transferPlayerOptions(players)} />
  </main>;
}

const SCOPE_ORDER: Record<string, number> = { lck: 0, challengers: 1, manual: 2, international_event: 3 };

// LCK·LCK CL·수동 등록·국제대회 선수를 모두 후보로 두고, 같은 닉네임은 LCK 쪽 기록 하나만 남긴다.
function transferPlayerOptions(players: Player[]) {
  const byName = new Map<string, Player>();
  for (const player of [...players].sort((a, b) => (SCOPE_ORDER[a.importedScope ?? "lck"] ?? 9) - (SCOPE_ORDER[b.importedScope ?? "lck"] ?? 9))) {
    const key = normalizeTransferName(player.name);
    if (key && !byName.has(key)) byName.set(key, player);
  }
  return [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, position, realName, searchAliases }) => ({ name, position, keywords: [realName, ...(searchAliases ?? [])].filter(Boolean) }));
}
