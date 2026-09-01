import { notFound } from "next/navigation";

import { CommunityRules } from "@/components/community/community-rules";
import { PageHeader } from "@/components/ui/page-header";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

// 팀마다 거의 동일한 내용이라(허브 /community/rules와 중복) 색인에서 제외한다.
export const metadata = { title: "커뮤니티 이용 규칙", robots: { index: false } };

export default async function FanCommunityRulesPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <main className="community-neutral fan-page-container flex flex-col gap-5 py-7 md:py-9">
      <PageHeader
        eyebrow="COMMUNITY"
        title="이용 규칙"
        breadcrumbs={[
          { label: "팀 홈", href: `/fan/${teamSlug}` },
          { label: "커뮤니티", href: `/fan/${teamSlug}/community` },
          { label: "이용 규칙" },
        ]}
      />
      <div className="max-w-3xl">
        <CommunityRules />
      </div>
    </main>
  );
}
