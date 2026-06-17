import { SectionHeader } from "@/components/layout/section-header";
import { getAllTeams } from "@/lib/data/lck";
import type { Team } from "@/lib/types";

import { updateInternationalTeamMediaAction } from "./actions";

function inputClassName() {
  return "min-w-0 rounded-md border border-border bg-background px-3 py-2 font-normal";
}

function TeamMediaCard({ team }: { team: Team }) {
  return (
    <form action={updateInternationalTeamMediaAction} className="flex h-full flex-col gap-4 rounded-md border border-border bg-surface p-4">
      <input type="hidden" name="teamId" value={team.id} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{team.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {team.slug} · {team.leaguepediaPage || "Leaguepedia page 없음"}
          </p>
          <p className="mt-1 text-sm text-muted">수집 범위: {team.importedScope || "unknown"}</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={`${team.name} 로고`} className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-[10px] text-muted">NO LOGO</span>
            )}
          </div>
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            {team.profileImageUrl ? (
              <img src={team.profileImageUrl} alt={`${team.name} 프로필`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-muted">NO IMG</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          로고 URL
          <input name="logoUrl" defaultValue={team.logoUrl ?? ""} placeholder="이미지 URL 입력" required className={inputClassName()} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          프로필 이미지 URL
          <input name="profileImageUrl" defaultValue={team.profileImageUrl ?? ""} placeholder="선택" className={inputClassName()} />
        </label>
      </div>

      <button type="submit" className="mt-auto rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
        저장
      </button>
    </form>
  );
}

export default async function AdminInternationalTeamsPage() {
  const teams = await getAllTeams();
  const internationalTeams = teams.filter((team) => !team.isLckTeam);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader
        eyebrow="관리자"
        title="해외팀 관리"
      />

      <section className="flex flex-col gap-4" aria-labelledby="international-team-media">
        <div>
          <h2 id="international-team-media" className="text-xl font-semibold">
            로고 / 프로필 이미지
          </h2>
          <p className="mt-1 text-sm text-muted">
            해외팀만 카드형으로 보여주고, 각 팀의 로고와 프로필 이미지만 직접 저장합니다.
          </p>
        </div>

        {internationalTeams.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {internationalTeams.map((team) => (
              <TeamMediaCard key={team.id} team={team} />
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
