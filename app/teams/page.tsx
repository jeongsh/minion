import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getTeamsSortedByRank } from "@/lib/data/lck";

export default async function TeamsPage() {
  const teams = await getTeamsSortedByRank();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="팀" title="LCK 팀 목록" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            style={{ backgroundColor: team.primaryColor }}
            className="group flex flex-col overflow-hidden rounded-xl transition-transform duration-200 hover:scale-[1.03] hover:shadow-xl"
          >
            {/* 로고 + 팀명 영역 */}
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10">
              {team.logoWhiteUrl || team.logoUrl ? (
                <img
                  src={team.logoWhiteUrl || team.logoUrl}
                  alt={team.name}
                  className="h-24 w-24 object-contain drop-shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">
                  {team.shortName?.slice(0, 2)}
                </div>
              )}
              <div className="text-center">
                <p className="text-sm font-bold leading-tight text-white drop-shadow">
                  {team.name}
                </p>
                <p className="mt-0.5 text-xs text-white/60">{team.shortName}</p>
              </div>
            </div>

            {/* 하단 감독/코치 */}
            <div className="bg-black/40 px-4 py-3 backdrop-blur-sm">
              {team.headCoach || team.coaches ? (
                <div className="space-y-0.5">
                  {team.headCoach && (
                    <p className="text-xs text-white/80">
                      <span className="text-white/50">감독</span>{" "}
                      {team.headCoach}
                    </p>
                  )}
                  {team.coaches && (
                    <p className="text-xs text-white/80">
                      <span className="text-white/50">코치</span>{" "}
                      {team.coaches}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-white/30">정보 없음</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
