import Link from "next/link";
import { getTeamById } from "@/lib/team-themes";
import type { Player } from "@/lib/types";

export function PlayerCard({ player }: { player: Player }) {
  const team = getTeamById(player.teamId);

  return (
    <article className="rounded-md border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-accent">{player.position}</p>
      <h2 className="mt-2 text-xl font-semibold">{player.name}</h2>
      <p className="mt-1 text-sm text-muted">
        {player.realName} · {team?.shortName ?? "소속 미정"}
      </p>
      <Link
        href={`/players/${player.slug}`}
        className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
      >
        선수 상세
      </Link>
    </article>
  );
}
