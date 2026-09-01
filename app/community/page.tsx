import type { Metadata } from "next";

import { CommunityFeedPage } from "@/components/community/community-feed-page";

export const metadata: Metadata = {
  title: "커뮤니티 | MINION",
  description: "LCK 팬들과 자유롭게 소통하는 커뮤니티입니다.",
  // 사용자 생성 콘텐츠 피드라 검색 색인 대상에서 제외한다.
  robots: { index: false },
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; cat?: string; q?: string; view?: string }>;
}) {
  const query = await searchParams;
  return (
    <CommunityFeedPage
      scope="hub"
      eyebrow="COMMUNITY"
      title="커뮤니티"
      page={Number(query.page) || 1}
      category={query.cat}
      search={query.q}
      hotOnly={query.view === "hot"}
    />
  );
}
