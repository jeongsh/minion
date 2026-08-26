import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Heart from 'lucide-react-native/icons/heart';
import Play from 'lucide-react-native/icons/play';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { ErrorState } from '@/components/feedback-states';
import { FanInstagramModal } from '@/components/fan/fan-instagram-modal';
import { FanVideoThumbnail, InstagramGlyph } from '@/components/fan/fan-shared';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamsPageDto } from '@/lib/api-client';

export function TeamsScreen() {
  const params = useLocalSearchParams<{ team?: string | string[] }>();
  const selectedKey = Array.isArray(params.team) ? params.team[0] : params.team;
  const path = `/api/mobile/v1/teams?view=explorer${selectedKey ? `&team=${encodeURIComponent(selectedKey)}` : ''}`;
  const { data, error, loading, refresh } = useCachedQuery<MobileTeamsPageDto>(path);

  if (loading && !data) return <MinionScreen contentStyle={styles.screen}><TeamsLoadingSkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen contentStyle={styles.screen}><View style={styles.error}><ErrorState onRetry={refresh} title={error} /></View></MinionScreen>;
  if (!data?.selected) return <MinionScreen contentStyle={styles.screen}><View style={styles.error}><ErrorState onRetry={refresh} title="둘러볼 팀을 준비하고 있습니다." /></View></MinionScreen>;

  return <MinionScreen contentStyle={styles.screen}><TeamsContent data={data} /></MinionScreen>;
}

function TeamsContent({ data }: { data: MobileTeamsPageDto }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const selected = data.selected!;
  const followedIds = useMemo(() => new Set(data.followedTeamIds), [data.followedTeamIds]);
  const orderedTeams = useMemo(() => data.items
    .map((team, index) => ({ index, team }))
    .sort((a, b) => Number(followedIds.has(b.team.id)) - Number(followedIds.has(a.team.id)) || a.index - b.index)
    .map(({ team }) => team), [data.items, followedIds]);

  return (
    <View>
      <View accessibilityLabel="팀 둘러보기" style={[styles.explorer, { borderBottomColor: theme.border }]}>
        <Text accessibilityRole="header" style={[styles.explorerTitle, { color: theme.ink, fontFamily: fonts.display }]}>팀 둘러보기</Text>
        <ScrollView contentContainerStyle={styles.teamRail} horizontal showsHorizontalScrollIndicator={false}>
          {orderedTeams.map((team) => {
            const active = team.id === selected.team.id;
            const following = followedIds.has(team.id);
            return (
              <Pressable
                accessibilityLabel={`${team.name} ${team.shortName}`}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                aria-current={active ? 'true' : undefined}
                key={team.id}
                onPress={() => router.replace(`/teams?team=${encodeURIComponent(team.fanSiteHost || team.slug)}` as never)}
                style={({ pressed }) => [styles.teamCard, { backgroundColor: active ? theme.ink : theme.surfaceMuted, opacity: pressed ? 0.82 : 1 }]}
              >
                {following ? <View accessibilityLabel="팔로잉" style={[styles.following, { backgroundColor: theme.accent }]}><Heart color={theme.accentForeground} fill={theme.accentForeground} size={11} /></View> : null}
                <View style={[styles.teamLogoCircle, { backgroundColor: active ? '#ffffff' : theme.surface }]}><TeamLogo plain size={36} team={team} themeAware={!active} /></View>
                <Text numberOfLines={1} style={[styles.teamShort, { color: active ? theme.surface : theme.text, fontFamily: fonts.medium }]}>{team.shortName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <View style={[styles.selectedCard, { backgroundColor: theme.surfaceMuted }]}>
          <View style={styles.selectedIdentity}>
            <TeamLogo plain size={44} team={selected.team} themeAware />
            <Text numberOfLines={1} style={[styles.selectedName, { color: theme.ink, fontFamily: fonts.black }]}>{selected.team.shortName}</Text>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.navigate(`/fan/${selected.team.fanSiteHost}` as never)} style={({ pressed }) => [styles.fanLink, { backgroundColor: theme.ink, opacity: pressed ? 0.82 : 1 }]}>
            <Text style={[styles.fanLinkText, { color: theme.surface, fontFamily: fonts.medium }]}>팬페이지</Text><ArrowRight color={theme.surface} size={15} />
          </Pressable>
        </View>
        <TeamSocial items={selected.social} />
        <TeamVideos teamSlug={selected.team.fanSiteHost} videos={selected.videos} />
      </View>
    </View>
  );
}

function TeamSocial({ items }: { items: NonNullable<MobileTeamsPageDto['selected']>['social'] }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const slides = items.slice(0, 12);
  const cardWidth = (width - 48) / 3;
  return (
    <View accessibilityLabel="최신 소셜 피드" style={styles.socialSection}>
      <View style={styles.sectionHeading}><InstagramGlyph color={theme.ink} size={18} /><Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.ink, fontFamily: fonts.display }]}>최신 소셜 피드</Text></View>
      {slides.length ? (
        <ScrollView contentContainerStyle={styles.socialRail} horizontal showsHorizontalScrollIndicator={false}>
          {slides.map((item, index) => {
            const uri = resolveApiAssetUrl(item.image?.url);
            return <Pressable accessibilityLabel={item.title || `@${item.ownerName}`} accessibilityRole="button" key={item.id} onPress={() => setOpenIndex(index)} style={[styles.socialCard, { backgroundColor: theme.surfaceMuted, width: cardWidth }]}>{uri ? <Image contentFit="cover" source={{ uri }} style={StyleSheet.absoluteFill} transition={150} /> : null}<InstagramGlyph color="#ffffff" size={16} style={styles.instagramMark} /></Pressable>;
          })}
        </ScrollView>
      ) : <TeamEmpty title="아직 보여줄 소셜 피드가 없습니다." detail="새 게시물이 잡히면 팬 홈에 먼저 띄워둘게요." />}
      {openIndex !== null ? <FanInstagramModal items={items} onClose={() => setOpenIndex(null)} startIndex={openIndex} /> : null}
    </View>
  );
}

function TeamVideos({ teamSlug, videos }: { teamSlug: string; videos: NonNullable<MobileTeamsPageDto['selected']>['videos'] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const cardWidth = (width - 32) / 1.18;
  return (
    <View accessibilityLabel="최신 영상" style={styles.videoSection}>
      <View style={styles.sectionHeading}><Play color={theme.ink} size={18} /><Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.ink, fontFamily: fonts.display }]}>최신 영상</Text></View>
      {videos.length ? (
        <ScrollView contentContainerStyle={styles.videoRail} horizontal showsHorizontalScrollIndicator={false}>
          {videos.slice(0, 12).map((video) => <Pressable accessibilityLabel={`${video.title} ${video.channelName ?? ''}`} accessibilityRole="link" key={video.id} onPress={() => router.navigate(`/fan/${teamSlug}/videos` as never)} style={{ width: cardWidth }}><FanVideoThumbnail compact item={video} /></Pressable>)}
        </ScrollView>
      ) : <TeamEmpty title="등록된 영상이 없습니다." />}
    </View>
  );
}

function TeamEmpty({ detail, title }: { detail?: string; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.empty, { borderColor: theme.border }]}><Text style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>{title}</Text>{detail ? <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>{detail}</Text> : null}</View>;
}

function TeamsLoadingSkeleton() {
  const { theme } = useMinionTheme();
  const block = { backgroundColor: theme.surfaceMuted };
  return <View accessibilityLabel="팀 정보를 불러오는 중"><View style={[styles.explorer, { borderBottomColor: theme.border }]}><View style={[styles.skeletonTitle, block]} /><ScrollView contentContainerStyle={styles.teamRail} horizontal showsHorizontalScrollIndicator={false}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.teamCard, block]}><View style={[styles.teamLogoCircle, { backgroundColor: theme.card }]} /><View style={[styles.skeletonShort, { backgroundColor: theme.card }]} /></View>)}</ScrollView></View><View style={styles.body}><View style={[styles.selectedCard, block]} /><View style={styles.socialSection}><View style={[styles.skeletonHeading, block]} /><View style={styles.skeletonSocialRow}>{Array.from({ length: 3 }, (_, index) => <View key={index} style={[styles.skeletonSocial, block]} />)}</View></View><View style={styles.videoSection}><View style={[styles.skeletonHeading, block]} /><View style={[styles.skeletonVideo, block]} /></View></View></View>;
}

const styles = StyleSheet.create({
  body: { paddingBottom: 96, paddingHorizontal: 16, paddingTop: 28 },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, gap: 4, justifyContent: 'center', minHeight: 128, padding: 24 },
  error: { paddingHorizontal: 16, paddingVertical: 24 },
  explorer: { borderBottomWidth: 1, paddingVertical: 24 },
  explorerTitle: { fontSize: 17, letterSpacing: -0.34, lineHeight: 23, paddingHorizontal: 16 },
  fanLink: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 4, minHeight: 40, paddingHorizontal: 12 },
  fanLinkText: { fontSize: 13, lineHeight: 19.5 },
  following: { alignItems: 'center', borderRadius: 10, height: 20, justifyContent: 'center', position: 'absolute', right: 6, top: 6, width: 20, zIndex: 1 },
  instagramMark: { position: 'absolute', right: 8, top: 8 },
  screen: { gap: 0, marginTop: 0, paddingHorizontal: 0 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 15, lineHeight: 20.25 },
  selectedCard: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', height: 76, justifyContent: 'space-between', padding: 16 },
  selectedIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  selectedName: { flexShrink: 1, fontSize: 16, lineHeight: 24 },
  skeletonHeading: { borderRadius: 6, height: 20, width: 112 },
  skeletonShort: { borderRadius: 5, height: 13, width: 40 },
  skeletonSocial: { aspectRatio: 3 / 4, borderRadius: 12, flex: 1 },
  skeletonSocialRow: { flexDirection: 'row', gap: 8 },
  skeletonTitle: { borderRadius: 6, height: 23, marginHorizontal: 16, width: 96 },
  skeletonVideo: { aspectRatio: 16 / 9, borderRadius: 8, width: '84.75%' },
  socialCard: { aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  socialRail: { gap: 8 },
  socialSection: { marginTop: 36 },
  teamCard: { alignItems: 'center', borderRadius: 16, gap: 8, height: 99.5, paddingHorizontal: 8, paddingVertical: 12, position: 'relative', width: 76 },
  teamLogoCircle: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  teamRail: { gap: 12, paddingBottom: 8, paddingHorizontal: 16, paddingTop: 16 },
  teamShort: { fontSize: 13, lineHeight: 19.5, maxWidth: '100%' },
  videoRail: { gap: 12 },
  videoSection: { marginTop: 40 },
});
