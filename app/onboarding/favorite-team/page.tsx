import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { safeOnboardingNext } from "@/lib/auth/onboarding";

export const metadata = { title: "최애팀 선택 · MINION", robots: { index: false, follow: false } };

export default async function FavoriteTeamOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeOnboardingNext((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding/favorite-team")}`);
  redirect(`/?onboarding=1&next=${encodeURIComponent(next)}`);
}
