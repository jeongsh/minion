import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/domain/player-card";
import { FanPageShell, FanSubpageHeader } from "@/components/fan/fan-page-shell";
import { getPlayers, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanPlayersPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const players = (await getPlayers()).filter((player) => player.teamId === team.id);

  return (
    <FanPageShell>
      <FanSubpageHeader title={`${team.shortName} 선수단`} description="현재 등록된 선수 프로필을 포지션 순서로 확인하세요." />
      <section className="fan-card grid grid-cols-2 gap-4 p-4 md:grid-cols-3 md:p-5 xl:grid-cols-5">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
        {!players.length ? <p className="col-span-full rounded-2xl bg-[var(--ui-surface-muted)] px-5 py-12 text-center text-sm text-[var(--ui-muted)]">등록된 선수가 없습니다.</p> : null}
      </section>
    </FanPageShell>
  );
}
