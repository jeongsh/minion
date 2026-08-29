import type { Metadata } from "next";

import { getAllTeams, getPlayerBySlug } from "@/lib/data/lck";
import { siteBaseUrl } from "@/lib/site";
import { PlayerDetailView } from "./player-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ playerSlug: string }> }): Promise<Metadata> {
  const { playerSlug } = await params;
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return { title: "선수를 찾을 수 없습니다 | MINION" };

  const teams = await getAllTeams();
  const team = teams.find((item) => item.id === player.teamId);
  const title = `${player.name}${team ? ` (${team.shortName})` : ""} | MINION`;
  const description = `${player.name} 선수의 최근 폼, 경기 기록, 스탯을 확인하세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/players/${playerSlug}` },
    openGraph: { title, description, url: `${siteBaseUrl()}/players/${playerSlug}`, type: "profile", images: ["/images/minion-og-20260829.png"] },
  };
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerSlug: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  const [{ playerSlug }, query] = await Promise.all([params, searchParams]);

  return (
    <PlayerDetailView
      playerSlug={playerSlug}
      segment={query.segment}
      linkBase="/players"
      breadcrumbLead={[{ label: "선수단", href: "/players" }]}
      showPosition
    />
  );
}
