import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayerById, getPlayerCareerHistories, getTeamsSortedByRank } from "@/lib/data/lck";
import { PlayerEditForm } from "./player-edit-form";

function leaguepediaWikiUrl(pageName: string) {
  return `https://lol.fandom.com/wiki/${pageName.replace(/ /g, "_")}`;
}

export default async function AdminPlayerDetailPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const [player, teams] = await Promise.all([
    getPlayerById(playerId),
    getTeamsSortedByRank(),
  ]);

  if (!player) {
    notFound();
  }

  const careerHistories = await getPlayerCareerHistories([player.id]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader eyebrow="관리자" title={`선수 관리 · ${player.name}`} />
        <Link
          href="/admin/players"
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          목록으로
        </Link>
      </div>

      <PlayerEditForm player={player} teams={teams} />

      {careerHistories.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">경력 기록</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {careerHistories.map((history) => (
              <li key={history.id}>
                {history.teamName ?? "팀 없음"} · {history.position} · {history.startDate.slice(0, 7)}
                {" ~ "}
                {history.endDate ? history.endDate.slice(0, 7) : "현재"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
