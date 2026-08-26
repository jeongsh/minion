import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { PlayerChampionUsageTable } from '@/components/players/player-champion-usage-table';
import { PlayerDetailLoadingSkeleton } from '@/components/players/player-detail-loading-skeleton';
import { PlayerDetailRadar } from '@/components/players/player-detail-radar';
import { PlayerFanReviews, type PlayerFanReviewsHandle } from '@/components/players/player-fan-reviews';
import { PlayerRecentMatches } from '@/components/players/player-recent-matches';
import { PlayerSegmentSelect } from '@/components/players/player-segment-select';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobilePlayerDetailDto } from '@/lib/api-client';

function statValue(value: number | null | undefined, decimals = 1) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(decimals);
}

function percentValue(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? '-' : `${Math.round(value)}%`;
}

function SocialIcon({ id, color }: { id: string; color: string }) {
  const paths: Record<string, string> = {
    twitterUrl: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    instagramUrl: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zM18 6.3a1.2 1.2 0 1 1-1.2 1.2 1.2 1.2 0 0 1 1.2-1.2z',
    youtubeUrl: 'M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.6 12 4.6 12 4.6s-5.8 0-7.6.6a2.8 2.8 0 0 0-2 2A29.4 29.4 0 0 0 2 12a29.4 29.4 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.6 7.6.6 7.6.6s5.8 0 7.6-.6a2.8 2.8 0 0 0 2-2 29.4 29.4 0 0 0 .4-4.8 29.4 29.4 0 0 0-.4-4.8zM10 15.5v-7l6 3.5z',
    facebookUrl: 'M13.5 9.5V7.7c0-.8.2-1.2 1.1-1.2h1.9V3.5h-2.8c-2.7 0-3.9 1.3-3.9 3.8v2.2H7v3.3h2.8V20h3.7v-7.2h2.5l.3-3.3z',
    discordUrl: 'M18.9 5.2A16.4 16.4 0 0 0 14.8 4l-.2.4a14.8 14.8 0 0 1 3.6 1.8l-.1-.1A16 16 0 0 0 12 4a16 16 0 0 0-6.1 1.1l.2-.1a14.8 14.8 0 0 1 3.6-1.8L9.5 4a16.4 16.4 0 0 0-4.1 1.2C2.7 8.8 2 12.3 2.3 15.7a16.5 16.5 0 0 0 5 2.5l1.2-1.9a10.7 10.7 0 0 1-2.9-1.4l.7.5a11.1 11.1 0 0 0 9.4 0l.7-.5a10.7 10.7 0 0 1-2.9 1.4l1.2 1.9a16.5 16.5 0 0 0 5-2.5c.4-4.1-.5-7.5-3.1-10.5zM9.7 13.6c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm4.6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z',
    streamUrl: 'M4 4h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  };
  const path = paths[id];
  return path ? <Svg height={16} viewBox="0 0 24 24" width={16}><Path d={path} fill={color} /></Svg> : null;
}

function SectionHeading({ caption, children }: { caption?: string; children: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 16, lineHeight: 22 }}>{children}</Text>
      {caption ? <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>{caption}</Text> : null}
    </View>
  );
}

function Profile({ accent, data }: { accent: string; data: MobilePlayerDetailDto }) {
  const { fonts, theme } = useMinionTheme();
  const imageUrl = resolveApiAssetUrl(data.player.profileImage?.url);
  const teamLogoUrl = resolveApiAssetUrl(data.team?.logo?.url);
  return (
    <View accessibilityLabel={`${data.player.name} 프로필`} style={styles.profile}>
      <View style={[styles.profileImage, { backgroundColor: theme.card }]}>
        {imageUrl ? <Image accessibilityLabel={data.player.name} contentFit="cover" contentPosition="top" source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} transition={120} /> : null}
        <View style={[styles.positionBadge, { backgroundColor: accent }]}>
          <Text style={{ color: '#ffffff', fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 }}>{data.player.position}</Text>
        </View>
      </View>
      <View style={styles.profileCopy}>
        <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 20, lineHeight: 27 }}>{data.player.name}</Text>
        {data.player.realName ? <Text numberOfLines={1} style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{data.player.realName}</Text> : null}
        <View style={styles.profileBottom}>
          <View style={styles.profileTeam}>
            {teamLogoUrl ? <Image accessibilityLabel={data.team?.name} contentFit="contain" source={{ uri: teamLogoUrl }} style={styles.profileTeamLogo} /> : null}
            <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 }}>{data.team?.shortName ?? 'FA'}</Text>
          </View>
          <View style={styles.socials}>
            {data.player.socialLinks.map((link) => (
              <Pressable accessibilityLabel={link.label} accessibilityRole="link" key={link.id} onPress={() => void Linking.openURL(link.url)} style={[styles.socialButton, { borderColor: theme.border }]}>
                <SocialIcon color={theme.ink} id={link.id} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function TeamMeta({ accent, data }: { accent: string; data: MobilePlayerDetailDto }) {
  const { fonts, theme } = useMinionTheme();
  const teamLogoUrl = resolveApiAssetUrl(data.team?.logo?.url);
  return (
    <View style={[styles.teamStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.teamStripTop}>
        <View style={styles.metaGroup}>
          <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 }}>팀</Text>
          {teamLogoUrl ? <Image accessibilityLabel={data.team?.name} contentFit="contain" source={{ uri: teamLogoUrl }} style={styles.teamLogo} /> : <Text style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 14 }}>{data.team?.shortName ?? '-'}</Text>}
        </View>
        <View style={styles.metaGroup}>
          <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>순위</Text>
          <Text style={{ color: accent, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 }}>{data.teamMeta.rank == null ? '-' : `${data.teamMeta.rank}위`}</Text>
        </View>
      </View>
      <View style={styles.metaGroup}>
        <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>최근 5경기</Text>
        <Text style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 16, letterSpacing: 0.4, lineHeight: 24 }}>{data.teamMeta.recent || '-'}</Text>
      </View>
    </View>
  );
}

function StatsSection({ accent, data }: { accent: string; data: MobilePlayerDetailDto }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View accessibilityLabel="선수 지표">
      <View style={styles.statsHeading}>
        <Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 16, lineHeight: 22 }}>선수 지표</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: accent }]} /><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13 }}>선수</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.muted }]} /><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13 }}>동 포지션 평균</Text></View>
        </View>
      </View>
      {data.axes.length ? <PlayerDetailRadar accent={accent} axes={data.axes} /> : <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 14 }}>표시할 경기 지표가 없습니다.</Text>}
    </View>
  );
}

function SeasonSummary({ data }: { data: MobilePlayerDetailDto }) {
  const { fonts, theme } = useMinionTheme();
  const headers = ['출전 세트', '승률', 'KDA', '최근 폼', '공식 POM'];
  const values = [String(data.season.setCount), percentValue(data.season.winRate), statValue(data.season.kda, 2), statValue(data.season.formScore), String(data.season.pomCount)];
  return (
    <View>
      <SectionHeading caption={data.season.label}>시즌 요약</SectionHeading>
      <View style={[styles.summaryFrame, { borderColor: theme.border }]}>
        <View style={[styles.summaryHeader, { backgroundColor: theme.card }]}>
          {headers.map((label) => <Text key={label} style={[styles.summaryCell, { color: theme.muted, fontFamily: fonts.medium }]}>{label}</Text>)}
        </View>
        <View style={styles.summaryValues}>
          {values.map((value, index) => (
            <View key={headers[index]} style={[styles.summaryValueWrap, index > 0 && { borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth }]}>
              <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 }}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const PLAYER_DETAIL_VIEW_VERSION = 'web-parity-v2';

function isPlayerDetailDto(value: unknown): value is MobilePlayerDetailDto {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<MobilePlayerDetailDto>;
  return candidate.schemaVersion === 2
    && Array.isArray(candidate.segments)
    && Array.isArray(candidate.axes)
    && Array.isArray(candidate.champions)
    && Array.isArray(candidate.recentMatches)
    && Boolean(candidate.player && Array.isArray(candidate.player.socialLinks))
    && Boolean(candidate.teamMeta)
    && Boolean(candidate.season)
    && Boolean(candidate.fan && Array.isArray(candidate.fan.reviews));
}

export function PlayerDetail() {
  const { playerSlug } = useLocalSearchParams<{ playerSlug: string }>();
  const { theme } = useMinionTheme();
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const fanReviewsRef = useRef<PlayerFanReviewsHandle>(null);

  useEffect(() => setSelectedSegment(null), [playerSlug]);
  const path = useMemo(() => {
    const base = `/api/mobile/v1/players/${encodeURIComponent(playerSlug ?? '')}?view=${PLAYER_DETAIL_VIEW_VERSION}`;
    return selectedSegment ? `${base}&segment=${encodeURIComponent(selectedSegment)}` : base;
  }, [playerSlug, selectedSegment]);
  const { data, error, loading, refresh } = useCachedQuery<MobilePlayerDetailDto>(path, { enabled: Boolean(playerSlug) });
  const playerData = isPlayerDetailDto(data) ? data : null;

  if (error && !playerData) return <MinionScreen><ErrorState onRetry={refresh} title={error} /></MinionScreen>;
  if (!playerData && (loading || data)) return <MinionScreen><PlayerDetailLoadingSkeleton /></MinionScreen>;
  if (!playerData) return <MinionScreen><ErrorState onRetry={refresh} title="선수 정보를 찾을 수 없습니다." /></MinionScreen>;

  const accent = playerData.team?.primaryColor || theme.accent;
  return (
    <MinionScreen onScrollYChange={() => fanReviewsRef.current?.checkViewport()}>
      <View style={styles.page}>
        <Profile accent={accent} data={playerData} />
        <PlayerSegmentSelect accent={accent} activeSegment={playerData.activeSegment} onClose={() => setSegmentOpen(false)} onOpen={() => setSegmentOpen(true)} onSelect={(value) => { setSegmentOpen(false); setSelectedSegment(value); }} open={segmentOpen} options={playerData.segments} />
        <TeamMeta accent={accent} data={playerData} />
        <StatsSection accent={accent} data={playerData} />
        <SeasonSummary data={playerData} />
        <View>
          <SectionHeading caption={`전체 ${playerData.champions.length}개`}>챔피언</SectionHeading>
          <PlayerChampionUsageTable accent={accent} rows={playerData.champions} />
        </View>
        <PlayerRecentMatches matches={playerData.recentMatches} />
        <PlayerFanReviews averageRating={playerData.fan.averageRating} pogCount={playerData.fan.pogCount} ref={fanReviewsRef} reviews={playerData.fan.reviews} />
      </View>
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  legend: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  metaGroup: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  page: { gap: 28, paddingTop: 8 },
  positionBadge: { borderRadius: 6, bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, position: 'absolute' },
  profile: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, minHeight: 91 },
  profileBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  profileCopy: { flex: 1, minWidth: 0 },
  profileImage: { borderRadius: 16, height: 80, overflow: 'hidden', position: 'relative', width: 80 },
  profileTeam: { alignItems: 'center', flexDirection: 'row', gap: 8, minWidth: 0 },
  profileTeamLogo: { height: 24, width: 24 },
  sectionHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  socialButton: { alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  socials: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  statsHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryCell: { flex: 1, fontSize: 13, lineHeight: 17, textAlign: 'center' },
  summaryFrame: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', height: 36 },
  summaryValueWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  summaryValues: { flexDirection: 'row', minHeight: 48 },
  teamLogo: { height: 30, width: 42 },
  teamStrip: { borderRadius: 16, borderWidth: 1, gap: 8, height: 100, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  teamStripTop: { alignItems: 'center', flexDirection: 'row', gap: 20 },
});
