import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { getTeamById, getTeamIdentityHistories } from "@/lib/data/lck";
import { TeamEditForm } from "./team-edit-form";

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);

  if (!team) {
    notFound();
  }

  const histories = (await getTeamIdentityHistories())
    .filter((history) => history.teamId === team.id)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader eyebrow="관리자" title={`팀 관리 · ${team.name}`} />
        <Link
          href="/admin/teams"
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          목록으로
        </Link>
      </div>

      <TeamEditForm team={team} histories={histories} />
    </main>
  );
}
