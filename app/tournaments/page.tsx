import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { getMatches, getTournaments } from "@/lib/data/lck";
import { DOMESTIC_SEGMENTS, INTERNATIONAL_SEGMENTS } from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Match, Tournament } from "@/lib/types";
import { formatDateRange } from "@/lib/view-data";

const ALL_SEGMENTS = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];

// 대회 카드는 여러 스플릿(예: LCK의 Cup/Rounds 1-2/Rounds 3-4)을 합쳐서 보여주는데,
// 이 스플릿들의 시작~종료일 전체 범위로 "진행중"을 판단하면 스플릿 사이 휴식기간(EWC
// 브레이크 등 실제 경기가 없는 기간)에도 진행중으로 표시된다. 그래서 대회 메타데이터의
// 날짜 범위 대신, 실제로 경기가 있는지(라이브 중이거나 최근/가까운 미래에 경기가 있는지)로
// 판단한다.
const ONGOING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function isSegmentOngoing(matches: Match[], tournamentIds: Set<string>, now: Date) {
  const nowMs = now.getTime();
  return matches.some((match) => {
    if (!tournamentIds.has(match.tournamentId)) return false;
    if (match.status === "live") return true;
    const matchMs = new Date(match.matchDate).getTime();
    return Number.isFinite(matchMs) && Math.abs(matchMs - nowMs) <= ONGOING_WINDOW_MS;
  });
}

function buildTournamentCards(tournaments: Tournament[], matches: Match[], now: Date) {
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
    const tournamentIds = new Set(matched.map((tournament) => tournament.id));

    return {
      ...segment,
      startDate: starts[0] ?? null,
      endDate: ends[ends.length - 1] ?? null,
      region: matched[0]?.region ?? "International",
      isOngoing: isSegmentOngoing(matches, tournamentIds, now),
    };
  }).filter((card): card is NonNullable<typeof card> => card != null);
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  // eslint-disable-next-line react-hooks/purity
  const now = new Date();
  const [tournaments, matches] = await Promise.all([getTournaments(), getMatches()]);

  const seasons = [...new Set(tournaments.map((tournament) => tournament.season))].sort(
    (a, b) => b - a,
  );
  const latestSeason = seasons[0] ?? now.getFullYear();
  const requestedSeason = params.year ? Number(params.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : latestSeason;

  const seasonTournaments = tournaments.filter((tournament) => tournament.season === activeSeason);
  const cards = buildTournamentCards(seasonTournaments, matches, now);

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
            const isOngoing = card.isOngoing;

            return (
              <Link
                key={card.key}
                href={`/tournaments/${card.key}?year=${activeSeason}`}
                className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl p-5 shadow-md transition-transform hover:-translate-y-1 sm:min-h-[220px] sm:p-6 sm:shadow-lg ${index === 0 ? "min-h-[176px]" : "min-h-[132px]"}`}
                style={{
                  backgroundColor: `color-mix(in srgb, ${card.accent} 76%, #0a0a12)`,
                  // ring-offset-* 유틸은 오프셋 색이 페이지 배경(--background)을 그대로 쓰는데,
                  // 라이트 모드에서 배경이 흰색이라 흰 링을 쓰면 오프셋 간격과 링이 똑같이
                  // 흰색이라 안 보였다. --accent(라이트/다크 모두 정의된 원색)를 직접 써서
                  // 두 테마 모두에서 카드 색과 무관하게 도드라지게 한다.
                  boxShadow: isOngoing
                    ? "0 0 0 2px var(--background), 0 0 0 4px var(--accent), 0 0 22px color-mix(in srgb, var(--accent) 65%, transparent)"
                    : undefined,
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold uppercase tracking-widest text-white/60">
                    {activeSeason} · {card.region}
                  </span>
                  {isOngoing ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-foreground)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-foreground)] motion-safe:animate-pulse" />
                      진행중
                    </span>
                  ) : null}
                </div>
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
