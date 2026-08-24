import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { CompactScoreboard } from '@/components/matches/compact-scoreboard';
import { MatchHeader } from '@/components/matches/match-header';
import { MatchLoadingSkeleton } from '@/components/matches/match-loading-skeleton';
import { MatchPlayerStatTable } from '@/components/matches/match-player-stat-table';
import { MatchSetSelector } from '@/components/matches/match-set-selector';
import { MatchTabNav, type MatchTabKey } from '@/components/matches/match-tab-nav';
import { MatchVideoTab } from '@/components/matches/match-video-tab';
import { SetTimelineSection } from '@/components/matches/set-timeline-section';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchDetailDto } from '@/lib/api-client';

const AVAILABLE_TABS: MatchTabKey[] = ['data', 'video'];

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { fonts, theme } = useMinionTheme();
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MatchTabKey>('data');

  const path = useMemo(() => {
    const base = `/api/mobile/v1/matches/${encodeURIComponent(matchId ?? '')}`;
    return selectedSetId ? `${base}?set=${encodeURIComponent(selectedSetId)}` : base;
  }, [matchId, selectedSetId]);

  const { data, error, loading, refresh } = useCachedQuery<MobileMatchDetailDto>(path, { enabled: Boolean(matchId) });

  if (loading && !data) {
    return (
      <MinionScreen>
        <MatchLoadingSkeleton />
      </MinionScreen>
    );
  }

  if (error && !data) {
    return (
      <MinionScreen>
        <ErrorState onRetry={refresh} />
      </MinionScreen>
    );
  }

  if (!data) return null;

  const activeSetId = selectedSetId ?? data.activeSetId ?? '';

  return (
    <MinionScreen contentStyle={styles.content}>
      <View style={styles.topBlock}>
        <MatchHeader header={data.header} match={data.match} />
        <MatchTabNav activeTab={activeTab} availableTabs={AVAILABLE_TABS} onSelect={setActiveTab} />
      </View>

      {activeTab === 'data' ? (
        <View style={styles.dataTab}>
          <MatchSetSelector activeSetId={activeSetId} onSelect={setSelectedSetId} sets={data.sets} />
          {data.activeSet ? (
            <View style={styles.setDetailBlock}>
              <CompactScoreboard set={data.activeSet} />
              <MatchPlayerStatTable set={data.activeSet} />
              <SetTimelineSection players={data.players} set={data.activeSet} />
            </View>
          ) : (
            <View style={[styles.emptyBox, { borderColor: theme.border }]}>
              <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14 }}>세트 데이터가 아직 연결되지 않았습니다.</Text>
            </View>
          )}
        </View>
      ) : null}

      {activeTab === 'video' ? <MatchVideoTab matchName={data.match.name} matchVodUrl={data.matchVodUrl} vods={data.vods} /> : null}
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20, paddingBottom: 48 },
  dataTab: { gap: 12 },
  emptyBox: { borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, padding: 16 },
  setDetailBlock: { gap: 20 },
  topBlock: { gap: 8 },
});
