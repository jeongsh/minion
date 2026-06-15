import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import type { Player, Team } from "@/lib/types";

const POSITION_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "원딜",
  SUP: "서폿",
};

function pickStarters(players: Player[]): (Player | null)[] {
  const byPosition = new Map<string, Player[]>();
  for (const p of players) {
    const arr = byPosition.get(p.position) ?? [];
    arr.push(p);
    byPosition.set(p.position, arr);
  }
  return POSITION_ORDER.map((pos) => {
    const candidates = byPosition.get(pos) ?? [];
    // is_starter 우선, 없으면 이름 오름차순 첫 번째
    return candidates.find((p) => p.isStarter) ?? candidates[0] ?? null;
  });
}

function StarterCard({ player, position }: { player: Player | null; position: string }) {
  if (!player) {
    return (
      <div className="flex flex-col rounded-md border border-dashed border-border bg-surface-muted p-4 opacity-40">
        <span className="text-xs font-semibold text-muted">{POSITION_LABEL[position]}</span>
        <span className="mt-2 text-sm text-muted">미정</span>
      </div>
    );
  }

  return (
    <Link
      href={`/players/${player.slug}`}
      className="group flex flex-col rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent hover:bg-surface-muted"
    >
      <span className="text-xs font-semibold text-accent">{POSITION_LABEL[position]}</span>
      <span className="mt-2 text-base font-bold leading-tight group-hover:text-accent">
        {player.name}
      </span>
      {player.realName && (
        <span className="mt-1 truncate text-xs text-muted">{player.realName}</span>
      )}
    </Link>
  );
}

function TeamRosterSection({
  team,
  players,
}: {
  team: Team;
  players: Player[];
}) {
  const starters = pickStarters(players);
  const hasAnyStarter = starters.some((p) => p !== null);
  if (!hasAnyStarter) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* 팀 헤더 */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderLeft: `4px solid ${team.primaryColor}` }}
      >
        <div className="flex flex-col">
          <Link
            href={`/teams/${team.slug}`}
            className="text-lg font-bold hover:text-accent"
          >
            {team.name}
          </Link>
          <span className="text-xs text-muted">{team.shortName}</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="grid grid-cols-5 gap-3">
          {POSITION_ORDER.map((pos, i) => (
            <StarterCard key={pos} player={starters[i] ?? null} position={pos} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function PlayersPage() {
  const [teams, players] = await Promise.all([getTeamsSortedByRank(), getPlayers()]);

  // teamId(UUID) → 선수 목록
  const playersByTeam = new Map<string, Player[]>();
  for (const player of players) {
    if (!player.teamId) continue;
    const arr = playersByTeam.get(player.teamId) ?? [];
    arr.push(player);
    playersByTeam.set(player.teamId, arr);
  }

  const teamsWithPlayers = teams.filter((t) => (playersByTeam.get(t.id) ?? []).length > 0);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="선수" title="선수 목록" />
      <div className="flex flex-col gap-6">
        {teamsWithPlayers.map((team) => (
          <TeamRosterSection
            key={team.id}
            team={team}
            players={playersByTeam.get(team.id) ?? []}
          />
        ))}
      </div>
    </main>
  );
}
