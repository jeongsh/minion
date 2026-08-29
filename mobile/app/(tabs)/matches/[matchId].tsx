import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { CompactScoreboard } from '@/components/matches/compact-scoreboard';
import { LiveMatchFeed } from '@/components/matches/live-match-feed';
import { MatchHeader } from '@/components/matches/match-header';
import { MatchLoadingSkeleton } from '@/components/matches/match-loading-skeleton';
import { MatchPlayerStatTable } from '@/components/matches/match-player-stat-table';
import { MatchPreviewTab } from '@/components/matches/match-preview-tab';
import { MatchRatingTab } from '@/components/matches/match-rating-tab';
import { MatchSetSelector } from '@/components/matches/match-set-selector';
import { MatchTabNav, type MatchTabKey } from '@/components/matches/match-tab-nav';
import { MatchVideoTab } from '@/components/matches/match-video-tab';
import { SetTimelineSection } from '@/components/matches/set-timeline-section';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin, type MobileMatchDetailDto } from '@/lib/api-client';

const COLLAPSIBLE_HEADER_HEIGHT = 56;

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { fonts, theme } = useMinionTheme();
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MatchTabKey>('data');
  const [setSelectorLayout, setSetSelectorLayout] = useState<{ tab: MatchTabKey; threshold: number } | null>(null);
  const [setSelectorStuck, setSetSelectorStuck] = useState(false);
  const latestScroll = useRef({ headerVisible: true, y: 0 });
  const setSelectorStuckRef = useRef(false);

  const path = useMemo(() => {
    const base = `/api/mobile/v1/matches/${encodeURIComponent(matchId ?? '')}`;
    return selectedSetId ? `${base}?set=${encodeURIComponent(selectedSetId)}` : base;
  }, [matchId, selectedSetId]);

  const { data, error, loading, refresh } = useCachedQuery<MobileMatchDetailDto>(path, { enabled: Boolean(matchId) });

  useEffect(() => {
    if (data && data.sets.length === 0 && activeTab === 'data') setActiveTab('preview');
  }, [activeTab, data]);

  const updateSetSelectorStuck = useCallback((nextStuck: boolean) => {
    if (setSelectorStuckRef.current === nextStuck) return;
    setSelectorStuckRef.current = nextStuck;
    setSetSelectorStuck(nextStuck);
  }, []);

  const handleSetSelectorLayout = useCallback((event: LayoutChangeEvent) => {
    // ScrollView 안의 콘텐츠가 공용 헤더 아래 16px에서 시작하므로 그 지점을 임계값에 포함한다.
    const threshold = event.nativeEvent.layout.y + 16;
    setSetSelectorLayout({ tab: activeTab, threshold });
    const stickyThreshold = threshold + (latestScroll.current.headerVisible ? 0 : COLLAPSIBLE_HEADER_HEIGHT);
    updateSetSelectorStuck(latestScroll.current.y >= stickyThreshold);
  }, [activeTab, updateSetSelectorStuck]);

  const handleScrollYChange = useCallback((scrollY: number, headerVisible: boolean) => {
    latestScroll.current = { headerVisible, y: scrollY };
    const selectorTabActive = activeTab === 'data' || activeTab === 'rating';
    const stickyThreshold = setSelectorLayout
      ? setSelectorLayout.threshold + (headerVisible ? 0 : COLLAPSIBLE_HEADER_HEIGHT)
      : null;
    const nextStuck = selectorTabActive && setSelectorLayout?.tab === activeTab && stickyThreshold !== null && scrollY >= stickyThreshold;
    updateSetSelectorStuck(nextStuck);
  }, [activeTab, setSelectorLayout, updateSetSelectorStuck]);

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
  const availableTabs: MatchTabKey[] = ['preview', ...(data.match.status !== 'completed' ? ['live' as const] : []), ...(data.sets.length > 0 ? ['data' as const] : []), 'rating', 'video'];
  const setSelectorVisible = data.sets.length > 0 && (activeTab === 'data' || activeTab === 'rating');
  const snapshotUrl = activeTab === 'rating' && data.fanRating?.snapshotAvailable
    ? `${mobileApiOrigin}/matches/${encodeURIComponent(data.match.id)}/sets/${encodeURIComponent(activeSetId)}/snapshot`
    : undefined;
  const stickySetSelectorVisible = setSelectorStuck && setSelectorLayout?.tab === activeTab;

  return (
    <MinionScreen
      contentStyle={styles.content}
      onScrollYChange={handleScrollYChange}
      stickyHeader={setSelectorVisible ? <MatchSetSelector activeSetId={activeSetId} onSelect={setSelectedSetId} sets={data.sets} snapshotUrl={snapshotUrl} /> : undefined}
      stickyHeaderReserveSpace={false}
      stickyHeaderVisible={stickySetSelectorVisible}>
      {/*
        스포일러 게이트는 목록/홈처럼 무심코 점수를 보게 되는 화면용이다. 특정 매치 상세로
        직접 들어온 사용자는 그 결과를 보려고 온 것이므로 여기서는 가리지 않고 바로 보여준다.
      */}
      <View style={styles.topBlock}>
        <MatchHeader header={data.header} match={data.match} />
        <MatchTabNav activeTab={activeTab} availableTabs={availableTabs} onSelect={setActiveTab} />
      </View>

      {activeTab === 'preview' ? <MatchPreviewTab data={data} /> : null}

      {activeTab === 'live' ? <LiveMatchFeed matchId={data.match.id} teamA={data.match.teamA} teamB={data.match.teamB} /> : null}

      {activeTab === 'data' ? (
        <View onLayout={handleSetSelectorLayout} style={styles.dataTab}>
          <View accessibilityElementsHidden={stickySetSelectorVisible} importantForAccessibility={stickySetSelectorVisible ? 'no-hide-descendants' : 'auto'}>
            <MatchSetSelector activeSetId={activeSetId} onSelect={setSelectedSetId} sets={data.sets} />
          </View>
          {data.activeSet ? (
            <View style={styles.setDetailBlock}>
              <CompactScoreboard set={data.activeSet} />
              <MatchPlayerStatTable set={data.activeSet} />
              <SetTimelineSection players={data.players} set={data.activeSet} />
            </View>
          ) : (
            <View style={[styles.emptyBox, { borderColor: theme.border }]}>
              <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>세트 데이터가 아직 연결되지 않았습니다.</Text>
            </View>
          )}
        </View>
      ) : null}

      {activeTab === 'rating' ? (
        <View onLayout={handleSetSelectorLayout} style={styles.ratingTab}>
          <View accessibilityElementsHidden={stickySetSelectorVisible} importantForAccessibility={stickySetSelectorVisible ? 'no-hide-descendants' : 'auto'}>
            <MatchSetSelector activeSetId={activeSetId} onSelect={setSelectedSetId} sets={data.sets} snapshotUrl={snapshotUrl} />
          </View>
          <MatchRatingTab panel={data.fanRating} />
        </View>
      ) : null}

      {activeTab === 'video' ? <MatchVideoTab matchName={data.match.name} matchVodUrl={data.matchVodUrl} vods={data.vods} /> : null}
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20, paddingBottom: 0, paddingTop: 4 },
  dataTab: { gap: 16, marginTop: -20 },
  emptyBox: { borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, padding: 16 },
  ratingTab: { gap: 16, marginTop: -20 },
  setDetailBlock: { gap: 20 },
  topBlock: { gap: 8 },
});
