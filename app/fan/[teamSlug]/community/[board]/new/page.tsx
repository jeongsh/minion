import { redirect } from "next/navigation";

// 구 게시판별 글쓰기 경로 → 통합 글쓰기로 리다이렉트(말머리 기본값으로 board 전달).
export default async function FanBoardNewRedirect({
  params,
}: {
  params: Promise<{ teamSlug: string; board: string }>;
}) {
  const { teamSlug, board } = await params;
  redirect(`/fan/${teamSlug}/community/new?cat=${board}`);
}
