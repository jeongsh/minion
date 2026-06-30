import { notFound } from "next/navigation";

import { NewPostPage } from "@/components/community/new-post-page";
import { getHubBoard } from "@/lib/community/boards";

export default async function HubNewPostPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board: boardSlug } = await params;
  const board = getHubBoard(boardSlug);
  if (!board) notFound();

  return (
    <NewPostPage
      scope="hub"
      boardSlug={board.slug}
      boardLabel={board.label}
      eyebrow="커뮤니티"
    />
  );
}
