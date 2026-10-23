import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { TournamentBracket } from '@/components/tournaments/tournament-bracket';
import { TournamentSwissBracket } from '@/components/tournaments/tournament-swiss-bracket';
import { TournamentFilterSheet, type TournamentFilterGroup } from '@/components/tournaments/tournament-filter-sheet';
import { TournamentLoadingSkeleton } from '@/components/tournaments/tournament-loading-skeleton';
import { TournamentEmptyNotice, TournamentPomList, TournamentStandingsGroups } from '@/components/tournaments/tournament-standings';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTournamentDetailDto } from '@/lib/api-client';
import { readTournamentSelection, restoreTournamentSelection, saveTournamentSelection, type TournamentSelection } from '@/lib/tournament-selection-cache';

type ViewKey = 'pom' | 'standings' | 'bracket';
type SplitKey = '1' | '2' | '3';

export default function TournamentsRoute() {
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const segment = Array.isArray(params.segment) ? params.segment[0] : params.segment;
  const [restored, setRestored] = useState(readTournamentSelection);
  const [ready, setReady] = useState(() => Boolean(segment || readTournamentSelection()));
  useEffect(() => {
    let active = true;
    if (!ready) void restoreTournamentSelection().then(selection => { if (active) { setRestored(selection); setReady(true); } });
    return () => { active = false; };
  }, [ready]);
  if (!ready) return <MinionScreen contentStyle={styles.screenContent}><View style={styles.page}><TournamentLoadingSkeleton /></View></MinionScreen>;
  return <TournamentsScreen initialSegment={segment} initialSelection={restored} key={segment ?? 'default'} />;
}

function TournamentsScreen({ initialSegment, initialSelection }: { initialSegment?: string; initialSelection: TournamentSelection | null }) {
  const saved = !initialSegment || initialSegment === initialSelection?.segmentKey ? initialSelection : null;
  const { fonts, theme } = useMinionTheme();
  const insets = useSafeAreaInsets();
  const [segmentKey, setSegmentKey] = useState(initialSegment ?? saved?.segmentKey ?? 'lck');
  const [year, setYear] = useState<number | null>(saved?.year ?? null);
  const [split, setSplit] = useState<SplitKey | null>(saved?.split ?? null);
  const [phase, setPhase] = useState<'playin' | 'playoffs' | null>(saved?.phase ?? null);
  const [view, setView] = useState<ViewKey | null>(saved?.view ?? null);
  const [activeBracketStageId, setActiveBracketStageId] = useState<string | null>(saved?.activeBracketStageId ?? null);
  const [filterOpen, setFilterOpen] = useState(false);
  const appliedDefaultSegment = useRef(Boolean(initialSegment || saved));

  const query = new URLSearchParams();
  if (year !== null) query.set('year', String(year));
  if (segmentKey === 'lck') {
    if (split) query.set('split', split);
    if (phase) query.set('phase', phase);
  } else if (activeBracketStageId) query.set('bracketStage', activeBracketStageId);
  if (view) query.set('view', view);
  const { data, error, loading, refresh } = useCachedQuery<MobileTournamentDetailDto>(`/api/mobile/v1/tournaments/${segmentKey}?${query}`, { keepPreviousData: true });

  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) refresh();
    hasFocused.current = true;
  }, [refresh]));
  useEffect(() => {
    if (data && !loading && !error && appliedDefaultSegment.current) saveTournamentSelection({ segmentKey, year, split, phase, view, activeBracketStageId });
  }, [data, loading, error, segmentKey, year, split, phase, view, activeBracketStageId]);

  useEffect(() => {
    if (!data || appliedDefaultSegment.current) return;
    appliedDefaultSegment.current = true;
    if (year === null) setYear(data.activeSeason);
    const currentIsOngoing = data.segmentNav.find((item) => item.key === segmentKey)?.isOngoing;
    if (!currentIsOngoing) {
      const ongoing = data.segmentNav.find((item) => item.isOngoing);
      if (ongoing) setSegmentKey(ongoing.key);
    }
  }, [data, segmentKey, year]);

  function resetStage() {
    setSplit(null);
    setPhase(null);
    setView(null);
    setActiveBracketStageId(null);
  }

  if (loading && !data) return <MinionScreen contentStyle={styles.screenContent}><View style={styles.page}><TournamentLoadingSkeleton /></View></MinionScreen>;
  if (error && !data) return <MinionScreen contentStyle={styles.screenContent}><View style={styles.page}><ErrorState onRetry={refresh} /></View></MinionScreen>;
  if (!data) return <MinionScreen contentStyle={styles.screenContent}><View style={styles.page}><TournamentLoadingSkeleton /></View></MinionScreen>;

  const groups: TournamentFilterGroup[] = [
    { label: '연도', selected: String(data.activeSeason), options: data.seasons.map(season => ({ value: String(season), label: String(season) })), onSelect: value => { setYear(Number(value)); resetStage(); } },
    { label: '대회', selected: data.segment.key, options: data.segmentNav.map(item => ({ ...item, value: item.key, label: item.name })), onSelect: value => { setSegmentKey(value); resetStage(); } },
  ];
  let title: string;
  if (data.isLck) {
    const activeSplit = data.activeSplit ?? '1';
    const regularLabel = activeSplit === '3' ? '그룹 배틀' : data.viewLabels?.standings ?? '순위표';
    const options = [
      { value: 'pom', label: 'POM' },
      { value: 'standings', label: regularLabel },
      ...(activeSplit === '2' ? [{ value: 'bracket', label: data.viewLabels?.bracket ?? '로드 투 MSI' }] : [{ value: 'playin', label: '플레이인' }, { value: 'playoffs', label: '플레이오프' }]),
    ];
    const active = data.activeView === 'bracket' && activeSplit !== '2' ? data.activePhase ?? 'playin' : data.activeView;
    groups.push(
      { label: '시즌 구간', selected: activeSplit, options: (['1', '2', '3'] as const).map(key => ({ value: key, label: data.splitLabels?.[key] ?? key })), onSelect: value => { setSplit(value as SplitKey); setView(null); setPhase(null); } },
      { label: '세부 단계', selected: active, options, onSelect: value => {
        if (value === 'playin' || value === 'playoffs') { setView('bracket'); setPhase(value); }
        else setView(value as ViewKey);
      } },
    );
    const splitTitle = activeSplit === '1' ? data.splitLabels?.[activeSplit] ?? 'LCK 컵' : `${data.segment.name} ${data.splitLabels?.[activeSplit] ?? activeSplit}`;
    const phaseTitle = data.activeView === 'pom' ? 'POM 순위' : data.activeView === 'standings' ? `${regularLabel} 순위표` : `${options.find(option => option.value === active)?.label ?? '대진표'} 대진표`;
    title = `${splitTitle} ${phaseTitle}`;
  } else {
    if (data.bracketStages.length > 0) groups.push({ label: '세부 단계', selected: data.activeBracketStageId ?? '', options: data.bracketStages.map(stage => ({ value: stage.id, label: stage.name })), onSelect: value => { setActiveBracketStageId(value); setView(null); } });
    if (data.supportsGroupToggle) groups.push({ label: '보기', selected: data.activeView, options: [{ value: 'standings', label: '순위표' }, { value: 'bracket', label: '대진표' }], onSelect: value => setView(value as ViewKey) });
    title = [data.segment.name, data.bracketStages.find(stage => stage.id === data.activeBracketStageId)?.name, data.activeView === 'standings' ? '순위표' : '대진표'].filter(Boolean).join(' ');
  }

  return <>
    <MinionScreen contentStyle={styles.screenContent}>
      <View style={[styles.page, data.isLck && styles.lckPage]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.ink, ...fonts.display }]}>{title}</Text>
        <TournamentBody data={data} />
      </View>
    </MinionScreen>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <Pressable accessibilityLabel="필터 열기" accessibilityRole="button" onPress={() => setFilterOpen(true)} style={[styles.fab, { bottom: theme.size.footerDockClearance + insets.bottom, backgroundColor: theme.ink, borderColor: theme.border }]}>
        <SlidersHorizontal color={theme.surface} size={20} />
      </Pressable>
    </View>
    <TournamentFilterSheet groups={groups} onClose={() => setFilterOpen(false)} open={filterOpen} />
  </>;
}

function TournamentBody({ data }: { data: MobileTournamentDetailDto }) {
  const { theme } = useMinionTheme();
  if (data.activeView === 'pom') return <TournamentPomList rows={data.pomRows ?? []} />;
  if (data.activeView === 'standings') return data.standingsGroups ? <TournamentStandingsGroups groups={data.standingsGroups} /> : <TournamentEmptyNotice message="아직 등록된 순위가 없습니다." />;
  if (data.swissBracket) return <TournamentSwissBracket data={data.swissBracket} />;
  if (data.bracketAvailable && data.bracket) return <TournamentBracket accent={theme.accent} bracket={data.bracket} showFormat={Boolean(data.worldsPhase)} />;
  return <TournamentEmptyNotice message={data.isLck ? '아직 공개된 일정이 없습니다.' : '아직 공개된 대진표가 없습니다.'} />;
}

const styles = StyleSheet.create({
  fab: { alignItems: 'center', borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', position: 'absolute', right: 16, width: 48, zIndex: 60 },
  lckPage: { gap: 24 },
  page: { gap: 16, marginTop: 24, paddingBottom: 88 },
  screenContent: { gap: 0, marginTop: 0, paddingBottom: 0 },
  title: { fontSize: 20, lineHeight: 28 },
});
