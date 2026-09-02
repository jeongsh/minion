import type { Metadata } from "next";

import { NewPostPage } from "@/components/community/new-post-page";
import { celebrationPostTitle, findTodayCelebration } from "@/lib/calendar/events";

export const metadata: Metadata = { title: "글쓰기", robots: { index: false } };

export default async function HubNewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; celebrate?: string }>;
}) {
  const { cat, celebrate } = await searchParams;

  // 팀이 없는 기념일은 허브로 온다. 오늘 기념일이 아닌 키는 무시.
  const celebration = celebrate ? await findTodayCelebration(celebrate) : null;

  return (
    <NewPostPage
      scope="hub"
      initialCategory={cat}
      initialTitle={celebration ? celebrationPostTitle(celebration) : undefined}
    />
  );
}
