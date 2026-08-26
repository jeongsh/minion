import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { TournamentBracket } from '@/components/tournaments/tournament-bracket';
import { TournamentHeader } from '@/components/tournaments/tournament-header';
import { TournamentLoadingSkeleton } from '@/components/tournaments/tournament-loading-skeleton';
import { TournamentSegmentSwitcher } from '@/components/tournaments/tournament-segment-switcher';
import { TournamentEmptyNotice, TournamentPomList, TournamentStandingsGroups } from '@/components/tournaments/tournament-standings';
import { TournamentSegmentedControl, TournamentUnderlineNav, type TournamentTabItem } from '@/components/tournaments/tournament-tabs';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTournamentDetailDto } from '@/lib/api-client';

type ViewKey = 'pom' | 'standings' | 'bracket';

function buildQuery({
  activeBracketStageId,
  isLck,
  phase,
  split,
  view,
  year,
}: {
  activeBracketStageId: string | null;
  isLck: boolean;
  phase: 'playin' | 'playoffs';
  split: '1' | '2' | '3';
  view: ViewKey;
  year: number | null;
}) {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  if (isLck) {
    params.set('split', split);
    params.set('view', view);
    if (view === 'bracket') params.set('phase', phase);
  } else {
    params.set('view', view === 'pom' ? 'standings' : view);
    if (activeBracketStageId) params.set('bracketStage', activeBracketStageId);
  }
  return params.toString();
}

export default function TournamentsScreen() {
  const { fonts, theme } = useMinionTheme();
  const [segmentKey, setSegmentKey] = useState('lck');
  const [year, setYear] = useState<number | null>(null);
  const [split, setSplit] = useState<'1' | '2' | '3'>('1');
  const [phase, setPhase] = useState<'playin' | 'playoffs'>('playin');
  const [view, setView] = useState<ViewKey>('standings');
  const [activeBracketStageId, setActiveBracketStageId] = useState<string | null>(null);
  const appliedDefaultSegment = useRef(false);

  const isLck = segmentKey === 'lck';
  const query = buildQuery({ activeBracketStageId, isLck, phase, split, view, year });
  const { data, error, loading, refresh } = useCachedQuery<MobileTournamentDetailDto>(`/api/mobile/v1/tournaments/${segmentKey}?${query}`);

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

  function selectSegment(key: string) {
    setSegmentKey(key);
    setSplit('1');
    setPhase('playin');
    setView('standings');
    setActiveBracketStageId(null);
  }

  if (loading && !data) {
    return (
      <MinionScreen contentStyle={styles.screenContent}>
        <View style={styles.page}>
          <TournamentLoadingSkeleton />
        </View>
      </MinionScreen>
    );
  }

  if (error && !data) {
    return (
      <MinionScreen contentStyle={styles.screenContent}>
        <View style={styles.page}>
          <ErrorState onRetry={refresh} />
        </View>
      </MinionScreen>
    );
  }

  if (!data) return null;

  const lckHasPhases = data.isLck && split !== '2';
  const viewItems: TournamentTabItem[] = data.isLck
    ? lckHasPhases
      ? [
          { key: 'pom', label: 'POM' },
          { key: 'standings', label: data.viewLabels?.standings ?? '순위표' },
          { key: 'playin', label: '플레이-인' },
          { key: 'playoffs', label: '플레이오프' },
        ]
      : [
          { key: 'pom', label: 'POM' },
          { key: 'standings', label: data.viewLabels?.standings ?? '순위표' },
          { key: 'bracket', label: data.viewLabels?.bracket ?? '대진표' },
        ]
    : data.supportsGroupToggle
      ? [
          { key: 'standings', label: '순위표' },
          { key: 'bracket', label: '대진표' },
        ]
      : [];

  const activeViewKey =
    data.isLck && lckHasPhases
      ? data.activeView === 'bracket'
        ? (data.activePhase ?? 'playin')
        : data.activeView
      : data.activeView;

  function selectView(key: string) {
    if (data!.isLck) {
      if (key === 'playin' || key === 'playoffs') {
        setView('bracket');
        setPhase(key);
      } else {
        setView(key as ViewKey);
      }
      return;
    }
    setView(key as ViewKey);
  }

  return (
    <MinionScreen contentStyle={styles.screenContent}>
      <View style={styles.page}>
        <TournamentHeader segment={data.segment} />
        <View style={styles.segmentRow}>
          <TournamentSegmentSwitcher activeKey={segmentKey} items={data.segmentNav} onSelect={selectSegment} />
        </View>

        {data.isLck ? (
          <View style={styles.lckSection}>
            <View style={styles.lckTabs}>
              <TournamentSegmentedControl
                activeKey={split}
                items={(['1', '2', '3'] as const).map((key) => ({ key, label: data.splitLabels?.[key] ?? key }))}
                onSelect={(key) => {
                  setSplit(key as '1' | '2' | '3');
                  if (view === 'bracket') setPhase('playin');
                }}
              />
              <TournamentUnderlineNav activeKey={activeViewKey} bordered={false} items={viewItems} onSelect={selectView} />
            </View>
            <TournamentBody data={data} />
          </View>
        ) : (
          <View style={styles.nonLckSection}>
            <View style={styles.nonLckHeader}>
              <View style={styles.nonLckTitleGroup}>
                <Text style={[styles.nonLckTitle, { color: theme.ink, ...fonts.display }]}>
                  {data.activeView === 'standings' ? '조 순위' : '대진표'}
                </Text>
                {viewItems.length > 0 ? <TournamentUnderlineNav activeKey={activeViewKey} bordered={false} items={viewItems} onSelect={selectView} /> : null}
              </View>
              {data.bracketStages.length > 1 ? (
                <TournamentSegmentedControl
                  activeKey={data.activeBracketStageId ?? ''}
                  items={data.bracketStages.map((stage) => ({ key: stage.id, label: stage.name }))}
                  onSelect={(key) => {
                    setActiveBracketStageId(key);
                    setView('standings');
                  }}
                />
              ) : null}
            </View>
            <TournamentBody data={data} />
          </View>
        )}
      </View>
    </MinionScreen>
  );
}

function TournamentBody({ data }: { data: MobileTournamentDetailDto }) {
  if (data.activeView === 'pom') return <TournamentPomList rows={data.pomRows ?? []} />;
  if (data.activeView === 'standings') {
    return data.standingsGroups
      ? <TournamentStandingsGroups groups={data.standingsGroups} />
      : <TournamentEmptyNotice message="아직 등록된 순위가 없습니다." />;
  }
  if (data.bracketAvailable && data.bracket) {
    return <TournamentBracket accent={data.segment.accent} bracket={data.bracket} />;
  }
  return <TournamentEmptyNotice message={data.isLck ? '아직 공개된 일정이 없습니다.' : '아직 공개된 대진표가 없습니다.'} />;
}

const styles = StyleSheet.create({
  lckSection: { gap: 24 },
  lckTabs: { gap: 12 },
  nonLckHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  nonLckSection: { gap: 16 },
  nonLckTitle: { fontSize: 20, lineHeight: 26 },
  nonLckTitleGroup: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  page: { gap: 24, marginTop: 8 },
  screenContent: { gap: 0, paddingBottom: 0 },
  segmentRow: { alignItems: 'center', flexDirection: 'row' },
});
