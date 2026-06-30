import { redirect } from "next/navigation";

// 구 게시판별 글쓰기 경로 → 통합 글쓰기로 리다이렉트(말머리 기본값으로 board 전달).
export default async function HubBoardNewRedirect({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board } = await params;
  redirect(`/community/new?cat=${board}`);
}
