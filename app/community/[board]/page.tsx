import { notFound } from "next/navigation";

import { BoardPage } from "@/components/community/board-page";
import { getHubBoard, hubBoards } from "@/lib/community/boards";

export function generateStaticParams() {
  return hubBoards.map((board) => ({ board: board.slug }));
}

export default async function HubBoardPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board: boardSlug } = await params;
  const board = getHubBoard(boardSlug);
  if (!board) notFound();

  return (
    <BoardPage
      scope="hub"
      boardSlug={board.slug}
      boardLabel={board.label}
      eyebrow="커뮤니티"
    />
  );
}
