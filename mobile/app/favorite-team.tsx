import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MobileTeamFavoriteDto } from '../../packages/contracts/src/mobile-v1';
import { BottomSheet } from '@/components/bottom-sheet';
import { minionTeams } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

function safeNext(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/favorite-team') ? value : '/me';
}

export default function FavoriteTeamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { fonts, setFavoriteTeam, theme } = useMinionTheme();
  const { loading, refreshViewer, session, viewer } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(typeof params.next === 'string' ? params.next : undefined);

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent('/favorite-team')}` as never);
    else if (viewer?.favoriteTeamId) router.replace(next as never);
  }, [loading, next, router, session, viewer?.favoriteTeamId]);

  const applyTeam = async () => {
    const team = minionTeams.find((candidate) => candidate.id === selectedTeamId);
    if (!team || pendingTeamId) return;
    setPendingTeamId(team.id);
    setError(null);
    try {
      await mutateMobileApi<MobileTeamFavoriteDto>(`/api/mobile/v1/teams/${encodeURIComponent(team.slug)}/favorite`, 'POST', { favorite: true });
      setFavoriteTeam(team);
      await refreshViewer();
      router.replace(next as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '최애팀을 저장하지 못했습니다. 잠시 뒤 다시 시도해주세요.');
      setPendingTeamId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBackground }]}>
      <BottomSheet
        maxHeight="92%"
        onClose={() => router.replace(next as never)}
        open={!loading && Boolean(session)}
        scrollable
        title="최애팀 선택"
      >
        <View style={styles.progressTrack}><View style={[styles.progressFill, { backgroundColor: theme.accent }]} /></View>
        <Text style={[styles.title, { color: theme.ink, ...fonts.display }]}>어느 팀을 응원하세요?</Text>
        <Text style={[styles.description, { color: theme.muted, ...fonts.regular }]}>최애팀 소식과 팬페이지를 더 빠르게 만날 수 있어요. 아직 없다면 건너뛰어도 괜찮아요.</Text>

        <View accessibilityLabel="최애팀 선택" style={styles.grid}>
          {minionTeams.map((team) => {
            const pending = pendingTeamId === team.id;
            const selected = selectedTeamId === team.id;
            return (
              <Pressable
                accessibilityLabel={`${team.name}을 최애팀으로 선택`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={Boolean(pendingTeamId)}
                key={team.id}
                onPress={() => setSelectedTeamId(team.id)}
                style={({ pressed }) => [styles.team, { backgroundColor: selected || pressed ? theme.cardHover : theme.surface, borderColor: selected ? theme.accent : theme.border, opacity: pendingTeamId && !pending ? 0.55 : 1 }]}
              >
                <View style={styles.logoCircle}><Image contentFit="contain" source={team.logo} style={styles.logo} /></View>
                <Text numberOfLines={1} style={[styles.teamName, { color: theme.ink, ...fonts.medium }]}>{team.shortName}</Text>
                <View style={[styles.check, { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accent : theme.surface }]}>
                  {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Check color={selected ? theme.accentForeground : 'transparent'} size={13} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable disabled={Boolean(pendingTeamId)} onPress={() => router.replace(next as never)} style={({ pressed }) => [styles.skip, { backgroundColor: pressed ? theme.cardHover : 'transparent', opacity: pendingTeamId ? 0.5 : 1 }]}>
            <Text style={[styles.skipText, { color: theme.muted, ...fonts.medium }]}>건너뛰기</Text>
          </Pressable>
          <Pressable disabled={!selectedTeamId || Boolean(pendingTeamId)} onPress={() => void applyTeam()} style={[styles.apply, { backgroundColor: theme.accent, opacity: selectedTeamId && !pendingTeamId ? 1 : 0.45 }]}>
            {pendingTeamId ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={[styles.applyText, { color: theme.accentForeground, ...fonts.medium }]}>선택한 팀 적용</Text>}
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  progressTrack: { backgroundColor: '#343840', borderRadius: 999, height: 4, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: 4, width: '100%' },
  title: { fontSize: 24, lineHeight: 32, marginTop: 20, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 24, marginTop: 8, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  team: { alignItems: 'center', borderRadius: 12, borderWidth: 1, gap: 6, justifyContent: 'center', minHeight: 96, paddingHorizontal: 8, paddingVertical: 8, width: '48.8%' },
  logoCircle: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  logo: { height: 36, width: 36 },
  teamName: { fontSize: 15, lineHeight: 20, maxWidth: '100%' },
  check: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 24, justifyContent: 'center', position: 'absolute', right: 8, top: 8, width: 24 },
  error: { color: '#dc2626', fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  skip: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  skipText: { fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
  apply: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
  applyText: { fontSize: 14, lineHeight: 20 },
});
