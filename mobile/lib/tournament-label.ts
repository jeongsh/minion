import type { MobileTournamentSummary } from '@/lib/api-client';

/** 웹 lib/match-display.ts의 tournamentTypeLabel과 동일한 규칙(LCK Cup / First Stand / 국제대회 / LCK {split}). */
export function tournamentTypeLabel(tournament?: MobileTournamentSummary | null) {
  if (!tournament) return '-';
  if (tournament.split === 'Cup') return 'LCK Cup';
  if (tournament.split === 'First Stand' || tournament.league === 'First Stand') return 'First Stand';
  if (tournament.category === 'international') return tournament.league ?? tournament.split ?? tournament.name;
  return tournament.split ? `LCK ${tournament.split}` : (tournament.league ?? tournament.name);
}
