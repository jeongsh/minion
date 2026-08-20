import { CommunityFeedPage } from "@/components/community/community-feed-page";

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
