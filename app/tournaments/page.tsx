import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { getTournaments } from "@/lib/data/lck";
import { DOMESTIC_SEGMENTS, INTERNATIONAL_SEGMENTS } from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Tournament } from "@/lib/types";
import { formatDateRange } from "@/lib/view-data";

const ALL_SEGMENTS = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];

function buildTournamentCards(tournaments: Tournament[]) {
  return ALL_SEGMENTS.map((segment) => {
    const matched = tournaments.filter((tournament) => matchesTournamentSegment(tournament, segment.key));

    if (matched.length === 0) return null;

    const starts = matched
      .map((tournament) => tournament.startDate)
      .filter((value): value is string => Boolean(value))
      .sort();
    const ends = matched
      .map((tournament) => tournament.endDate)
      .filter((value): value is string => Boolean(value))
      .sort();

    return {
      ...segment,
      startDate: starts[0] ?? null,
      endDate: ends[ends.length - 1] ?? null,
      region: matched[0]?.region ?? "International",
    };
  }).filter((card): card is NonNullable<typeof card> => card != null);
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const tournaments = await getTournaments();

  const seasons = [...new Set(tournaments.map((tournament) => tournament.season))].sort(
    (a, b) => b - a,
  );
  const latestSeason = seasons[0] ?? new Date().getFullYear();
  const requestedSeason = params.year ? Number(params.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : latestSeason;

  const seasonTournaments = tournaments.filter((tournament) => tournament.season === activeSeason);
  const cards = buildTournamentCards(seasonTournaments);

  return (
    <main className="layout-wide flex flex-col gap-6 py-6 sm:gap-8 sm:py-10">
      <PageHeader
        eyebrow="TOURNAMENTS"
        title="대회"
        action={
          seasons.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => (
                <Link
                  key={season}
                  href={`/tournaments?year=${season}`}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                    season === activeSeason
                      ? "bg-accent text-accent-foreground"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  {season}
                </Link>
              ))}
            </div>
          ) : null
        }
      />

      {cards.length === 0 ? (
        <p className="text-sm text-muted">{activeSeason} 시즌에 등록된 대회가 없습니다.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 min-[1200px]:grid-cols-3">
          {cards.map((card, index) => {
            const dateRange = formatDateRange(card.startDate, card.endDate);

            return (
              <Link
                key={card.key}
                href={`/tournaments/${card.key}?year=${activeSeason}`}
                className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-md transition-transform hover:-translate-y-1 sm:min-h-[220px] sm:p-6 sm:shadow-lg ${index === 0 ? "min-h-[176px]" : "min-h-[132px]"} ${card.gradient}`}
              >
                <span
                  className="absolute inset-0 bg-[linear-gradient(115deg,transparent_55%,rgba(255,255,255,0.08)_55%,rgba(255,255,255,0.08)_58%,transparent_58%)]"
                  aria-hidden="true"
                />
                <span className="text-[13px] font-bold uppercase tracking-widest text-white/60">
                  {activeSeason} · {card.region}
                </span>
                <span className="mt-1.5 text-[22px] font-black text-white sm:mt-2 sm:text-[28px]">{card.name}</span>
                <span className="mt-1 line-clamp-1 text-[13px] font-medium text-white/70 sm:text-sm">{card.description}</span>
                {dateRange ? (
                  <span className="mt-3 inline-block w-fit rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold text-white sm:mt-4 sm:text-[13px]">
                    {dateRange}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
