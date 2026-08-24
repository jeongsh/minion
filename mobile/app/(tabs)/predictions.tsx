import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { PredictionAdSlot } from '@/components/predictions/prediction-ad-slot';
import { PredictionEmptyState } from '@/components/predictions/prediction-empty-state';
import { PredictionLoadingSkeleton } from '@/components/predictions/prediction-loading-skeleton';
import { PredictionMatchCard } from '@/components/predictions/prediction-match-card';
import { PredictionWeekBar } from '@/components/predictions/prediction-week-bar';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePredictionsDto } from '@/lib/api-client';
import { predictionDateLabel, weekStartKey } from '@/lib/prediction-dates';
import { dateKeyKST } from '@/lib/schedule-dates';

export default function PredictionsScreen() {
  const { fonts, showToast, theme } = useMinionTheme();
  const { data, error, loading, refresh } = useCachedQuery<MobilePredictionsDto>('/api/mobile/v1/predictions');
  const [selectedWeek, setSelectedWeek] = useState(() => weekStartKey(new Date().toISOString()));

  const weekKeys = useMemo(() => Array.from(new Set((data?.matches ?? []).map((match) => weekStartKey(match.startsAt)))).sort(), [data]);

  // 오늘이 속한 주에 경기가 없으면(웹도 동일하게 겪는 상황) prev/next가 index 0에 같이 묶여
  // 둘 다 막힐 수 있다. 데이터가 있는 주 중 가장 가까운 주로 한 번 스냅해 막다른 골목을 피한다.
  useEffect(() => {
    if (weekKeys.length === 0 || weekKeys.includes(selectedWeek)) return;
    const closest = weekKeys.find((key) => key >= selectedWeek) ?? weekKeys[weekKeys.length - 1];
    setSelectedWeek(closest);
  }, [weekKeys, selectedWeek]);

  const weekIndex = Math.max(0, weekKeys.indexOf(selectedWeek));
  const weekMatches = (data?.matches ?? []).filter((match) => weekStartKey(match.startsAt) === selectedWeek);
  const groupedMap = new Map<string, typeof weekMatches>();
  for (const match of weekMatches) {
    const key = dateKeyKST(match.startsAt);
    groupedMap.set(key, [...(groupedMap.get(key) ?? []), match]);
  }
  const groupedEntries = Array.from(groupedMap.entries());
  const todayKey = data ? dateKeyKST(new Date(data.now).toISOString()) : '';

  function moveWeek(direction: number) {
    const next = weekKeys[weekIndex + direction];
    if (next) setSelectedWeek(next);
  }

  function onChooseTeam() {
    showToast('로그인은 인증 화면 구현 단계에서 연결합니다.');
  }

  if (loading && !data) {
    return (
      <MinionScreen contentStyle={styles.content}>
        <PredictionLoadingSkeleton />
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

  return (
    <MinionScreen contentStyle={styles.content}>
      <PredictionWeekBar
        balance={null}
        canGoNext={weekIndex < weekKeys.length - 1}
        canGoPrev={weekIndex > 0}
        onNext={() => moveWeek(1)}
        onPrev={() => moveWeek(-1)}
        weekKey={selectedWeek}
      />
      <View style={styles.ad}>
        <PredictionAdSlot />
      </View>

      {groupedEntries.length > 0 ? (
        <View style={styles.sections}>
          {groupedEntries.map(([date, dayMatches]) => (
            <View key={date}>
              <View style={styles.headingRow}>
                <Text style={[styles.heading, { color: theme.ink, fontFamily: fonts.black }]}>{predictionDateLabel(dayMatches[0].startsAt)}</Text>
                {date === todayKey ? (
                  <View style={[styles.todayBadge, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.todayBadgeText, { color: theme.accentForeground, fontFamily: fonts.medium }]}>오늘</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.matchList}>
                {dayMatches.map((match) => (
                  <PredictionMatchCard key={match.id} match={match} now={data.now} onChooseTeam={onChooseTeam} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <PredictionEmptyState />
        </View>
      )}
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  ad: { marginTop: 16 },
  content: { gap: 24, paddingBottom: 80 },
  empty: { marginTop: 36 },
  heading: { fontSize: 18, lineHeight: 28 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  matchList: { gap: 20 },
  sections: { gap: 40, marginTop: 36 },
  todayBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 13, lineHeight: 20.2222 },
});
