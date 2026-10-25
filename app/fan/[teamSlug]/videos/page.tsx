import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PagedFanVideoFeed } from "@/components/fan/fan-video-feed";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import {
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";
import { getMediaPage, getMediaTabs } from "@/lib/fan/media-feed";

export const dynamic = "force-dynamic";

// 외부 유튜브 임베드 위주라 색인 가치가 낮고 팀마다 내용이 겹친다. title만 부여하고 색인 제외.
export const metadata: Metadata = { title: "영상", robots: { index: false } };

export default async function FanVideosPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) notFound();

  const [initialPage, tabs] = await Promise.all([getMediaPage(teamSlug, "videos"), getMediaTabs(teamSlug, "videos")]);

  return (
    <FanPageShell>
      <h1 className="sr-only">영상</h1>
      <PagedFanVideoFeed key={team.id} teamSlug={team.fanSiteHost || teamSlug} teamName={team.shortName} initialPage={initialPage} tabs={tabs} />
    </FanPageShell>
  );
}
