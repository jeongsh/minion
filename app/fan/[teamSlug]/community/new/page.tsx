import { notFound } from "next/navigation";

import { NewPostPage } from "@/components/community/new-post-page";
import { celebrationPostTitle, findTodayCelebration } from "@/lib/calendar/events";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanNewPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ cat?: string; celebrate?: string }>;
}) {
  const { teamSlug } = await params;
  const { cat, celebrate } = await searchParams;

  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  // 축하 배너에서 넘어온 경우 제목을 미리 채워준다. 오늘 기념일이 아닌 키는 무시.
  const celebration = celebrate
    ? await findTodayCelebration(celebrate, { teamId: team.id })
    : null;

  return (
    <NewPostPage
      scope="team"
      initialCategory={cat}
      initialTitle={celebration ? celebrationPostTitle(celebration) : undefined}
      teamId={team.id}
      teamSlug={teamSlug}
    />
  );
}
