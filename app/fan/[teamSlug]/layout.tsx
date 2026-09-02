import type { Metadata } from "next";

import { FanSiteLayout } from "@/components/fan/fan-site-layout";
import { FanChannelNavigation } from "@/components/fan/fan-channel-navigation";
import { siteBaseUrl } from "@/lib/site";
import { fanSiteHosts, getTeamByRouteKey } from "@/lib/team-themes";

export function generateStaticParams() {
  return fanSiteHosts.map((teamSlug) => ({ teamSlug }));
}

// 팬사이트 하위 페이지가 자기 metadata를 지정하지 않으면 전역 기본값("MINION | LCK")을
// 그대로 쓰게 되어 수십 개 페이지의 title이 중복된다. 팀 단위 기본값과 template을 여기서
// 잡아두면 하위는 "선수단" 같은 짧은 세그먼트만 넣어도 팀명이 붙는다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = getTeamByRouteKey(teamSlug);
  if (!team) return {};

  const fanSlug = team.fanSiteHost ?? teamSlug;
  const base = `${team.name} 팬 | MINION`;
  const description = `${team.name} 경기 일정, 선수단, 영상과 팬톡을 한곳에서 확인하세요.`;

  return {
    title: { default: base, template: `%s | ${team.name} 팬 | MINION` },
    description,
    openGraph: {
      title: base,
      description,
      url: `${siteBaseUrl()}/fan/${fanSlug}`,
      type: "website",
      images: ["/images/minion-og-20260829.png"],
    },
  };
}

export default async function FanTeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = getTeamByRouteKey(teamSlug);

  return (
    <FanSiteLayout teamSlug={teamSlug}>
      <FanChannelNavigation teamSlug={team?.fanSiteHost ?? teamSlug} />
      {children}
    </FanSiteLayout>
  );
}
