import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MobileTeamFavoriteDto } from '../../packages/contracts/src/mobile-v1';
import { minionTeams, type MinionTeam } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

function safeNext(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/favorite-team') ? value : '/me';
}

export default function FavoriteTeamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const insets = useSafeAreaInsets();
  const { fonts, setFavoriteTeam, theme } = useMinionTheme();
  const { loading, refreshViewer, session, viewer } = useAuth();
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(typeof params.next === 'string' ? params.next : undefined);

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent('/favorite-team')}` as never);
    else if (viewer?.favoriteTeamId) router.replace(next as never);
  }, [loading, next, router, session, viewer?.favoriteTeamId]);

  const selectTeam = async (team: MinionTeam) => {
    if (pendingTeamId) return;
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
    <View style={[styles.screen, { backgroundColor: theme.pageBackground, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.eyebrow, { color: theme.accent, fontFamily: fonts.medium }]}>마지막 한 단계</Text>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.display }]}>어느 팀을 응원하세요?</Text>
          <Text style={[styles.description, { color: theme.muted, fontFamily: fonts.regular }]}>최애팀 소식과 팬페이지를 더 빠르게 만날 수 있어요. 아직 없다면 건너뛰어도 괜찮아요.</Text>

          <View accessibilityLabel="최애팀 선택" style={styles.grid}>
            {minionTeams.map((team) => {
              const pending = pendingTeamId === team.id;
              return (
                <Pressable
                  accessibilityLabel={`${team.name}을 최애팀으로 선택`}
                  disabled={Boolean(pendingTeamId)}
                  key={team.id}
                  onPress={() => void selectTeam(team)}
                  style={({ pressed }) => [styles.team, { backgroundColor: pressed ? theme.cardHover : theme.surface, borderColor: pressed ? theme.accent : theme.border, opacity: pendingTeamId && !pending ? 0.55 : 1 }]}
                >
                  <View style={styles.logoCircle}><Image contentFit="contain" source={team.logo} style={styles.logo} /></View>
                  <Text numberOfLines={1} style={[styles.teamName, { color: theme.ink, fontFamily: fonts.medium }]}>{team.shortName}</Text>
                  <View style={[styles.check, { borderColor: pending ? theme.accent : theme.border, backgroundColor: pending ? theme.accent : theme.surface }]}>
                    {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Check color="transparent" size={13} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable disabled={Boolean(pendingTeamId)} onPress={() => router.replace(next as never)} style={({ pressed }) => [styles.skip, { backgroundColor: pressed ? theme.cardHover : 'transparent', opacity: pendingTeamId ? 0.5 : 1 }]}>
            <Text style={[styles.skipText, { color: theme.muted, fontFamily: fonts.medium }]}>아직 최애팀이 없어요 · 건너뛰기</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: 24 },
  card: { borderRadius: 24, borderWidth: 1, padding: 20 },
  eyebrow: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  title: { fontSize: 28, lineHeight: 36, marginTop: 8, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 24, marginTop: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  team: { alignItems: 'center', borderRadius: 16, borderWidth: 1, gap: 8, justifyContent: 'center', minHeight: 112, paddingHorizontal: 8, paddingVertical: 12, width: '48.5%' },
  logoCircle: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  logo: { height: 40, width: 40 },
  teamName: { fontSize: 14, lineHeight: 20, maxWidth: '100%' },
  check: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 24, justifyContent: 'center', position: 'absolute', right: 8, top: 8, width: 24 },
  error: { color: '#dc2626', fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: 'center' },
  skip: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 16 },
  skipText: { fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
});
