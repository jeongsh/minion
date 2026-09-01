import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlayerDetailView } from "@/app/players/[playerSlug]/player-detail-view";
import { getPlayerBySlug, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

// 팬사이트의 선수 상세는 /players/[playerSlug]와 내용이 같으므로 canonical을 정식 경로로
// 넘겨 중복 색인을 막는다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamSlug: string; playerSlug: string }>;
}): Promise<Metadata> {
  const { playerSlug } = await params;
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return { title: "선수를 찾을 수 없습니다" };
  return {
    title: player.name,
    description: `${player.name} 선수의 최근 폼, 경기 기록, 스탯을 확인하세요.`,
    alternates: { canonical: `/players/${playerSlug}` },
  };
}

export default async function FanPlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string; playerSlug: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  const [{ teamSlug, playerSlug }, query] = await Promise.all([params, searchParams]);
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const playersBase = `/fan/${teamSlug}/players`;

  return (
    <PlayerDetailView
      playerSlug={playerSlug}
      segment={query.segment}
      linkBase={playersBase}
      breadcrumbLead={[
        { label: team.shortName, href: `/fan/${teamSlug}` },
        { label: "선수", href: playersBase },
      ]}
    />
  );
}
