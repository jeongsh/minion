import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/domain/player-card";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import { getPlayers, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import type { Player } from "@/lib/types";

const POSITION_ORDER: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

function byRosterPriority(a: Player, b: Player) {
  const starterDiff = Number(b.isStarter) - Number(a.isStarter);

  if (starterDiff !== 0) {
    return starterDiff;
  }

  const positionDiff = POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  if (positionDiff !== 0) {
    return positionDiff;
  }

  return a.name.localeCompare(b.name);
}

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

  const players = (await getPlayers()).filter((player) => player.teamId === team.id).sort(byRosterPriority);

  return (
    <FanPageShell>
      <h1 className="sr-only">선수</h1>
      <section className="fan-card grid grid-cols-2 gap-2.5 py-2 sm:grid-cols-3 md:py-4 lg:grid-cols-4 xl:grid-cols-5">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} hrefBase={`/fan/${teamSlug}/players`} teamLabel={team.shortName} variant="fan" />
        ))}
        {!players.length ? <p className="col-span-full rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-12 text-center text-sm text-[var(--ui-muted)]">등록된 선수가 없습니다.</p> : null}
      </section>
    </FanPageShell>
  );
}
