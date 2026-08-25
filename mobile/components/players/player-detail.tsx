import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobilePlayerDetailDto } from '@/lib/api-client';

function DetailSkeleton() {
  const { theme } = useMinionTheme();
  return (
    <View accessibilityLabel="선수 정보를 불러오는 중입니다" style={styles.page}>
      <View style={styles.profileRow}>
        <View style={[styles.profileImage, { backgroundColor: theme.card }]} />
        <View style={styles.profileCopy}>
          <View style={[styles.skeletonName, { backgroundColor: theme.surfaceMuted }]} />
          <View style={[styles.skeletonRealName, { backgroundColor: theme.surfaceMuted }]} />
          <View style={[styles.skeletonTeam, { backgroundColor: theme.surfaceMuted }]} />
        </View>
      </View>
      <View style={[styles.teamStrip, { borderColor: theme.border }]}>
        <View style={[styles.skeletonLogo, { backgroundColor: theme.surfaceMuted }]} />
        <View style={[styles.skeletonMeta, { backgroundColor: theme.surfaceMuted }]} />
      </View>
      <View style={[styles.skeletonHeading, { backgroundColor: theme.surfaceMuted }]} />
      {Array.from({ length: 4 }, (_, index) => <View key={index} style={[styles.careerRow, { backgroundColor: theme.card }]} />)}
    </View>
  );
}

export function PlayerDetail() {
  const { playerSlug } = useLocalSearchParams<{ playerSlug: string }>();
  const { data, error, loading, refresh } = useCachedQuery<MobilePlayerDetailDto>(`/api/mobile/v1/players/${encodeURIComponent(playerSlug ?? '')}`, { enabled: Boolean(playerSlug) });
  const { fonts, theme } = useMinionTheme();

  if (loading && !data) return <MinionScreen><DetailSkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen><ErrorState onRetry={refresh} title={error} /></MinionScreen>;
  if (!data) return <MinionScreen><ErrorState onRetry={refresh} title="선수 정보를 찾을 수 없습니다." /></MinionScreen>;

  const imageUrl = resolveApiAssetUrl(data.player.profileImage?.url);
  const teamLogoUrl = resolveApiAssetUrl(data.team?.logo?.url);
  return (
    <MinionScreen>
      <View style={styles.page}>
        <View accessibilityLabel={`${data.player.name} 프로필`} style={styles.profileRow}>
          <View style={[styles.profileImage, { backgroundColor: theme.card }]}>
            {imageUrl ? <Image accessibilityLabel={data.player.name} contentFit="cover" contentPosition="top" source={imageUrl} style={StyleSheet.absoluteFill} transition={120} /> : null}
            <View style={[styles.positionBadge, { backgroundColor: data.team?.primaryColor ?? theme.accent }]}>
              <Text style={{ color: '#ffffff', fontFamily: fonts.bold, fontSize: 10, lineHeight: 16 }}>{data.player.position}</Text>
            </View>
          </View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 20, lineHeight: 25 }}>{data.player.name}</Text>
            {data.player.realName ? <Text numberOfLines={1} style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{data.player.realName}</Text> : null}
            <View style={styles.profileTeam}>
              {teamLogoUrl ? <Image accessibilityLabel={data.team?.name} contentFit="contain" source={teamLogoUrl} style={styles.profileTeamLogo} /> : null}
              <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>{data.team?.shortName ?? 'FA'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.teamStrip, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13 }}>팀</Text>
          {teamLogoUrl ? <Image accessibilityLabel={data.team?.name} contentFit="contain" source={teamLogoUrl} style={styles.teamLogo} /> : null}
          <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 14 }}>{data.team?.name ?? '-'}</Text>
        </View>

        <View>
          <Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 16, lineHeight: 24, marginBottom: 12 }}>선수 경력</Text>
          <View style={styles.careerList}>
            {data.career.length ? data.career.map((item) => (
              <View key={item.id} style={[styles.careerRow, { backgroundColor: theme.card }]}>
                <View style={styles.careerCopy}>
                  <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 }}>{item.teamName ?? 'FA'}</Text>
                  <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5 }}>{item.startDate} – {item.endDate ?? '현재'}</Text>
                </View>
                <Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 12 }}>{item.position}</Text>
              </View>
            )) : <View style={[styles.emptyCareer, { backgroundColor: theme.card }]}><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14 }}>등록된 선수 경력이 없습니다.</Text></View>}
          </View>
        </View>
      </View>
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 28, paddingTop: 8 },
  profileRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, minHeight: 80 },
  profileImage: { borderRadius: 16, height: 80, overflow: 'hidden', position: 'relative', width: 80 },
  positionBadge: { borderRadius: 6, bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, position: 'absolute' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileTeam: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  profileTeamLogo: { height: 24, width: 24 },
  teamStrip: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 76, paddingHorizontal: 20, paddingVertical: 14 },
  teamLogo: { height: 30, width: 30 },
  careerList: { gap: 8 },
  careerRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 },
  careerCopy: { flex: 1, gap: 2, minWidth: 0 },
  emptyCareer: { alignItems: 'center', borderRadius: 12, minHeight: 96, justifyContent: 'center', padding: 16 },
  skeletonName: { borderRadius: 4, height: 24, width: 112 },
  skeletonRealName: { borderRadius: 4, height: 14, marginTop: 8, width: 144 },
  skeletonTeam: { borderRadius: 4, height: 24, marginTop: 8, width: 80 },
  skeletonLogo: { borderRadius: 6, height: 30, width: 80 },
  skeletonMeta: { borderRadius: 4, height: 18, width: 112 },
  skeletonHeading: { borderRadius: 4, height: 20, width: 80 },
});
