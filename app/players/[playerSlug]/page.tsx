import { PlayerDetailView } from "./player-detail-view";

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
