import AsyncStorage from '@react-native-async-storage/async-storage';

export type TournamentSelection = {
  segmentKey: string;
  year: number | null;
  split: '1' | '2' | '3' | null;
  phase: 'playin' | 'playoffs' | null;
  view: 'pom' | 'standings' | 'bracket' | null;
  activeBracketStageId: string | null;
};
const STORAGE_KEY = 'minion-tournament-selection-v1';
let selection: TournamentSelection | null = null;
export function readTournamentSelection() { return selection; }
export async function restoreTournamentSelection() {
  if (selection) return selection;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TournamentSelection;
    if (!parsed || !['lck', 'first-stand', 'msi', 'worlds', 'kespa-cup', 'ewc', 'demacia-cup', 'enc'].includes(parsed.segmentKey)) return null;
    if (parsed.year !== null && !Number.isInteger(parsed.year)) return null;
    if (![null, '1', '2', '3'].includes(parsed.split)) return null;
    if (![null, 'playin', 'playoffs'].includes(parsed.phase)) return null;
    if (![null, 'pom', 'standings', 'bracket'].includes(parsed.view)) return null;
    if (parsed.activeBracketStageId !== null && typeof parsed.activeBracketStageId !== 'string') return null;
    selection = parsed;
  } catch { /* Storage availability must not block the live query. */ }
  return selection;
}
export function saveTournamentSelection(next: TournamentSelection) {
  if (JSON.stringify(selection) === JSON.stringify(next)) return;
  selection = next;
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}
