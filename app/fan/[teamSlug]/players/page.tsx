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
      <FanSubpageHeader
        title="선수단"
        breadcrumbs={[{ label: team.shortName, href: `/fan/${teamSlug}` }, { label: "선수단" }]}
      />
      <section className="fan-card grid grid-cols-2 gap-4 py-4 md:grid-cols-3 md:py-5 xl:grid-cols-5">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} hrefBase={`/fan/${teamSlug}/players`} variant="fan" />
        ))}
        {!players.length ? <p className="col-span-full rounded-2xl bg-[var(--ui-surface-muted)] px-5 py-12 text-center text-sm text-[var(--ui-muted)]">등록된 선수가 없습니다.</p> : null}
      </section>
    </FanPageShell>
  );
}
