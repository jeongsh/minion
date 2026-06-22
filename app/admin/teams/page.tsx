import { SectionHeader } from "@/components/layout/section-header";
import { getTeamsSortedByRank } from "@/lib/data/lck";
import { TeamList } from "./team-list";

export default async function AdminTeamsPage() {
  const teams = await getTeamsSortedByRank();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="팀 관리" />
      <p className="-mt-4 text-sm text-muted">팀을 선택해 브랜딩, 공식 링크, 변경 이력을 수정합니다.</p>
      <TeamList teams={teams} />
    </main>
  );
}
