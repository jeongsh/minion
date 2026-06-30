import { redirect } from "next/navigation";

// 구 게시판별 경로는 단일 피드로 통합됨 → 인덱스로 리다이렉트.
export default async function FanBoardRedirect({
  params,
}: {
  params: Promise<{ teamSlug: string; board: string }>;
}) {
  const { teamSlug } = await params;
  redirect(`/fan/${teamSlug}/community`);
}
