import { redirect } from "next/navigation";

import { FavoriteTeamStep } from "@/components/auth/favorite-team-step";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTeams } from "@/lib/data/lck";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const metadata = { title: "최애팀 선택 · MINION", robots: { index: false, follow: false } };

function safeNext(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/onboarding/")
    ? candidate
    : "/me";
}

export default async function FavoriteTeamOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding/favorite-team")}`);

  const supabase = await createSupabaseAuthClient();
  const [teams, { data: profile }] = await Promise.all([
    getTeams(),
    supabase.from("profiles").select("favorite_team_id").eq("id", user.id).maybeSingle(),
  ]);
  if (profile?.favorite_team_id) redirect(next);

  const options = teams.map((team) => ({
    id: team.id,
    slug: team.slug,
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl,
    logoWhiteUrl: team.logoWhiteUrl,
    useWhiteLogoOnDark: team.useWhiteLogoOnDark,
    fanSiteHost: team.fanSiteHost,
  }));

  return (
    <main className="layout-form flex min-h-[calc(100dvh-8rem)] items-center py-8 sm:py-12">
      <section className="w-full rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-sm sm:p-8" aria-labelledby="favorite-team-title">
        <div className="mb-6 text-center">
          <p className="text-[13px] font-medium text-[var(--accent)]">마지막 한 단계</p>
          <h1 id="favorite-team-title" className="mt-2 font-paperozi text-[28px] leading-tight text-[var(--ui-ink)]">어느 팀을 응원하세요?</h1>
          <p className="mt-3 text-base font-normal leading-6 text-[var(--ui-muted)]">최애팀 소식과 팬페이지를 더 빠르게 만날 수 있어요. 아직 없다면 건너뛰어도 괜찮아요.</p>
        </div>
        <FavoriteTeamStep teams={options} next={next} />
      </section>
    </main>
  );
}
