import { NewPostPage } from "@/components/community/new-post-page";

export default async function HubNewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  return <NewPostPage scope="hub" eyebrow="커뮤니티" initialCategory={cat} />;
}
