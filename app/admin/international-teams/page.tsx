import Link from "next/link";

import { SectionHeader } from "@/components/layout/section-header";
import { getAllPlayers, getAllTeams } from "@/lib/data/lck";
import type { Player, Team } from "@/lib/types";

function TeamCard({ team, players }: { team: Team; players: Player[] }) {
  const missingImages = players.filter((player) => !player.profileImageUrl).length;

  return (
    <Link
      href={`/admin/international-teams/${team.id}`}
      className="flex h-full flex-col gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{team.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {team.slug} · {team.leaguepediaPage || "Leaguepedia page 없음"}
          </p>
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt={`${team.name} 로고`} className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-[10px] text-muted">NO LOGO</span>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 text-sm">
        <span className="text-muted">선수 {players.length}명</span>
        {missingImages > 0 ? (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-500">
            이미지 누락 {missingImages}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500">
            이미지 완료
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function AdminInternationalTeamsPage() {
  const [teams, players] = await Promise.all([getAllTeams(), getAllPlayers()]);
  const internationalTeams = teams.filter((team) => !team.isLckTeam);

  const playersByTeam = new Map<string, Player[]>();
  for (const player of players) {
    if (player.isActive === false) continue;
    const list = playersByTeam.get(player.teamId) ?? [];
    list.push(player);
    playersByTeam.set(player.teamId, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="해외팀 관리" />

      <section className="flex flex-col gap-4" aria-labelledby="international-team-list">
        <div>
          <h2 id="international-team-list" className="text-xl font-semibold">
            팀 선택
          </h2>
          <p className="mt-1 text-sm text-muted">
            팀을 선택하면 팀 로고/프로필과 소속 선수들의 프로필 이미지 URL을 관리할 수 있습니다.
          </p>
        </div>

        {internationalTeams.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {internationalTeams.map((team) => (
              <TeamCard key={team.id} team={team} players={playersByTeam.get(team.id) ?? []} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted">
            해외팀으로 분류된 팀이 없습니다. DB의 `teams.is_lck_team` 값을 확인하세요.
          </p>
        )}
      </section>
    </main>
  );
}
