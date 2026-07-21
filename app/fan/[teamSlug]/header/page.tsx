import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { FanHeaderStudio } from "@/components/fan/fan-header-studio";
import { FanPageShell, FanSubpageHeader } from "@/components/fan/fan-page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getFanHeaderState } from "@/lib/fan/fan-header";

export const dynamic = "force-dynamic";

export default async function FanHeaderPage({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const user = await getCurrentUser();
  const state = await getFanHeaderState(team.id, user?.id);

  return (
    <FanPageShell>
      <div style={{ "--team-primary": team.primaryColor } as CSSProperties}>
        <FanSubpageHeader
          title="헤더 꾸미기"
          breadcrumbs={[{ label: team.shortName, href: `/fan/${teamSlug}` }, { label: "헤더 꾸미기" }]}
        />
        <div className="mt-6">
          <FanHeaderStudio
            teamId={team.id}
            teamSlug={team.fanSiteHost}
            teamName={team.shortName}
            teamColor={team.primaryColor}
            isSignedIn={Boolean(user)}
            currentUserId={user?.id}
            state={state}
          />
        </div>
      </div>
    </FanPageShell>
  );
}
