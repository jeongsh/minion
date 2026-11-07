import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommunityFeedPage } from "@/components/community/community-feed-page";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

// 팀 팬톡 첫 화면은 색인한다. 검색 결과와 2페이지 이후 목록은 중복 콘텐츠라 noindex로 둔다.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}): Promise<Metadata> {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) return { title: "팬톡", robots: { index: false } };
  const fanSlug = team.fanSiteHost || teamSlug;
  const indexable = !query.q && (Number(query.page) || 1) <= 1;
  return {
    title: `${team.name} 팬톡`,
    description: `${team.name} 팬들이 모여 LCK 경기 후기와 응원, 선수 소식, 이적시장·찌라시 이야기를 나누는 팬톡 커뮤니티입니다.`,
    alternates: { canonical: `/fan/${fanSlug}/community` },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function FanCommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ page?: string; cat?: string; q?: string; view?: string }>;
}) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <CommunityFeedPage
      scope="team"
      eyebrow="COMMUNITY"
      title="커뮤니티"
      teamId={team.id}
      teamSlug={teamSlug}
      page={Number(query.page) || 1}
      category={query.cat}
      search={query.q}
      hotOnly={query.view === "hot"}
    />
  );
}
