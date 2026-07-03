import Link from "next/link";

import { getTournaments } from "@/lib/data/lck";
import { INTERNATIONAL_SEGMENTS } from "@/lib/tournaments/international-segments";
import { segmentForTournament } from "@/lib/tournaments/season-2026";
import type { Tournament } from "@/lib/types";

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return null;

  const format = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}.${Number(day)}`;
  };

  return end && end !== start ? `${format(start)} ~ ${format(end)}` : format(start);
}

function buildTournamentCards(tournaments: Tournament[]) {
  return INTERNATIONAL_SEGMENTS.map((segment) => {
    const matched = tournaments.filter(
      (tournament) => segmentForTournament(tournament) === segment.key,
    );

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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-foreground">대회</h1>
        {seasons.length > 1 ? (
          <div className="flex gap-2">
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
        ) : null}
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted">{activeSeason} 시즌에 등록된 국제 대회가 없습니다.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const dateRange = formatDateRange(card.startDate, card.endDate);

            return (
              <Link
                key={card.key}
                href={`/tournaments/${card.key}?year=${activeSeason}`}
                className={`group relative isolate flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-lg transition-transform hover:-translate-y-1 ${card.gradient}`}
              >
                <span
                  className="absolute inset-0 bg-[linear-gradient(115deg,transparent_55%,rgba(255,255,255,0.08)_55%,rgba(255,255,255,0.08)_58%,transparent_58%)]"
                  aria-hidden="true"
                />
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                  {activeSeason} · {card.region}
                </span>
                <span className="mt-2 text-3xl font-black text-white">{card.name}</span>
                <span className="mt-1 text-sm font-medium text-white/70">{card.description}</span>
                {dateRange ? (
                  <span className="mt-4 inline-block w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
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
