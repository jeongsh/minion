import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { TournamentBracket } from '@/components/tournaments/tournament-bracket';
import { TournamentHeader } from '@/components/tournaments/tournament-header';
import { TournamentLoadingSkeleton } from '@/components/tournaments/tournament-loading-skeleton';
import { TournamentSegmentSwitcher } from '@/components/tournaments/tournament-segment-switcher';
import { TournamentEmptyNotice, TournamentPomList, TournamentStandingsGroups } from '@/components/tournaments/tournament-standings';
import { TournamentSegmentedControl, TournamentUnderlineNav, type TournamentTabItem } from '@/components/tournaments/tournament-tabs';
import { useCachedQuery } from '@/hooks/use-cached-query';
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
      <MinionScreen contentStyle={styles.content}>
        <TournamentLoadingSkeleton />
      </MinionScreen>
    );
  }

  if (error && !data) {
    return (
      <MinionScreen contentStyle={styles.content}>
        <ErrorState onRetry={refresh} />
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
          { key: 'pom', label: '순위' },
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
    <MinionScreen contentStyle={styles.content}>
      <TournamentHeader segment={data.segment} />
      <TournamentSegmentSwitcher activeKey={segmentKey} items={data.segmentNav} onSelect={selectSegment} />

      {data.isLck ? (
        <View style={styles.lckTabs}>
          <TournamentSegmentedControl
            activeKey={split}
            items={(['1', '2', '3'] as const).map((key) => ({ key, label: data.splitLabels?.[key] ?? key }))}
            onSelect={(key) => {
              setSplit(key as '1' | '2' | '3');
              setView('standings');
            }}
          />
          <TournamentUnderlineNav activeKey={activeViewKey} bordered={false} items={viewItems} onSelect={selectView} />
        </View>
      ) : (
        <View style={styles.nonLckTabs}>
          {viewItems.length > 0 ? <TournamentUnderlineNav activeKey={activeViewKey} bordered={false} items={viewItems} onSelect={selectView} /> : null}
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
      )}

      <View style={styles.body}>
        {data.activeView === 'pom' ? (
          <TournamentPomList rows={data.pomRows ?? []} />
        ) : data.activeView === 'standings' ? (
          data.standingsGroups ? <TournamentStandingsGroups groups={data.standingsGroups} /> : <TournamentEmptyNotice message="아직 등록된 순위가 없습니다." />
        ) : data.bracketAvailable && data.bracket ? (
          <TournamentBracket accent={data.segment.accent} bracket={data.bracket} />
        ) : (
          <TournamentEmptyNotice message="아직 공개된 대진표가 없습니다." />
        )}
      </View>
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 4 },
  content: { gap: 20, paddingBottom: 48 },
  lckTabs: { gap: 16 },
  nonLckTabs: { gap: 12 },
});
