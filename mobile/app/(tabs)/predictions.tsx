import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { PredictionEmptyState } from '@/components/predictions/prediction-empty-state';
import { PredictionBetSheet, type PredictionBetDialogState } from '@/components/predictions/prediction-bet-sheet';
import { PredictionLoadingSkeleton } from '@/components/predictions/prediction-loading-skeleton';
import { PredictionMatchCard } from '@/components/predictions/prediction-match-card';
import { PredictionWeekBar } from '@/components/predictions/prediction-week-bar';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi, type MobilePredictionMutationDto, type MobilePredictionsDto } from '@/lib/api-client';
import { predictionDateLabel, weekStartKey } from '@/lib/prediction-dates';
import { predictionMaxStake } from '@/lib/predictions';
import { dateKeyKST } from '@/lib/schedule-dates';
import { useAuth } from '@/providers/auth-provider';

export default function PredictionsScreen() {
  const router = useRouter();
  const { loading: authLoading, refreshViewer, session, viewer } = useAuth();
  const { fonts, showToast, theme } = useMinionTheme();
  const { data, error, loading, refresh } = useCachedQuery<MobilePredictionsDto>('/api/mobile/v1/predictions', { cache: false, enabled: !authLoading });
  const [selectedWeek, setSelectedWeek] = useState(() => weekStartKey(new Date().toISOString()));
  const [dialog, setDialog] = useState<PredictionBetDialogState | null>(null);
  const [stake, setStake] = useState('100');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);
  const balance = balanceOverride ?? data?.balance ?? viewer?.lp ?? null;

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

  function onChooseTeam(matchId: string, teamId: string) {
    if (authLoading) {
      showToast('로그인 상태를 확인하고 있습니다.');
      return;
    }
    if (!session) {
      router.push('/login?next=/predictions' as never);
      return;
    }
    const match = data?.matches.find((item) => item.id === matchId);
    const team = match?.teamA?.id === teamId ? match.teamA : match?.teamB?.id === teamId ? match.teamB : null;
    if (!match || !team || match.closed) return;
    const existingTeam = match.myBet?.teamId === match.teamA?.id ? match.teamA : match.myBet?.teamId === match.teamB?.id ? match.teamB : null;
    setStake(String(Math.min(1000, predictionMaxStake(balance ?? 0))));
    setMutationError(null);
    setDialog({ existingBet: match.myBet, matchId, teamId, teamName: existingTeam?.shortName ?? team.shortName });
  }

  async function submitBet() {
    if (!dialog || pending) return;
    setPending(true);
    setMutationError(null);
    try {
      const result = await mutateMobileApi<MobilePredictionMutationDto>('/api/mobile/v1/predictions', 'POST', {
        matchId: dialog.matchId,
        stake: Number(stake),
        teamId: dialog.teamId,
      });
      setBalanceOverride(result.balance);
      setDialog(null);
      showToast(`${dialog.teamName} 승리 예측이 확정됐습니다.`, 'success', 'prediction');
      refresh();
      await refreshViewer();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '예측을 등록하지 못했습니다.';
      setMutationError(message);
      showToast(message, 'error');
    } finally {
      setPending(false);
    }
  }

  async function cancelBet() {
    if (!dialog?.existingBet || pending) return;
    const refundedStake = dialog.existingBet.stake;
    setPending(true);
    setMutationError(null);
    try {
      const result = await mutateMobileApi<MobilePredictionMutationDto>('/api/mobile/v1/predictions', 'DELETE', { matchId: dialog.matchId });
      setBalanceOverride(result.balance);
      setDialog(null);
      showToast(`${refundedStake.toLocaleString('ko-KR')} LP가 반환됐습니다.`, 'success', 'prediction');
      refresh();
      await refreshViewer();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '예측을 취소하지 못했습니다.';
      setMutationError(message);
      showToast(message, 'error');
    } finally {
      setPending(false);
    }
  }

  if ((authLoading || loading) && !data) {
    return (
      <MinionScreen contentStyle={styles.content}>
        <PredictionLoadingSkeleton />
      </MinionScreen>
    );
  }

  if (error && !data) {
    return (
      <MinionScreen contentStyle={styles.content}>
        <ErrorState onRetry={refresh} title={error} />
      </MinionScreen>
    );
  }

  if (!data) return null;

  return (
    <MinionScreen contentStyle={styles.content}>
      <PredictionWeekBar
        authenticated={Boolean(session)}
        authLoading={authLoading}
        balance={balance}
        canGoNext={weekIndex < weekKeys.length - 1}
        canGoPrev={weekIndex > 0}
        onNext={() => moveWeek(1)}
        onPrev={() => moveWeek(-1)}
        weekKey={selectedWeek}
      />

      {groupedEntries.length > 0 ? (
        <View style={styles.sections}>
          {groupedEntries.map(([date, dayMatches]) => (
            <View key={date}>
              <View style={styles.headingRow}>
                <Text style={[styles.heading, { color: theme.ink, ...fonts.black }]}>{predictionDateLabel(dayMatches[0].startsAt)}</Text>
                {date === todayKey ? (
                  <View style={[styles.todayBadge, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.todayBadgeText, { color: theme.accentForeground, ...fonts.medium }]}>오늘</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.matchList}>
                {dayMatches.map((match) => (
                  <PredictionMatchCard key={match.id} match={match} now={data.now} onChooseTeam={(teamId) => onChooseTeam(match.id, teamId)} />
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
      <PredictionBetSheet
        balance={balance ?? 0}
        dialog={dialog}
        error={mutationError}
        onCancelBet={cancelBet}
        onClose={() => setDialog(null)}
        onStakeChange={setStake}
        onSubmit={submitBet}
        pending={pending}
        stake={stake}
      />
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0, paddingBottom: 0 },
  empty: { marginTop: 36 },
  heading: { fontSize: 18, lineHeight: 28 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 12 },
  matchList: { gap: 20 },
  sections: { gap: 40, marginTop: 36 },
  todayBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 13, lineHeight: 20.2222 },
});
