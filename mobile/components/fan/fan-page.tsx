import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Heart from 'lucide-react-native/icons/heart';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Star from 'lucide-react-native/icons/star';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { boardLabel, displayAuthor, formatCommunityDate } from '@/components/community/community-utils';
import { ErrorState } from '@/components/feedback-states';
import { FanCalendarDialog } from '@/components/fan/fan-calendar-dialog';
import { FanLoadingSkeleton } from '@/components/fan/fan-loading-skeleton';
import { FanInstagramModal } from '@/components/fan/fan-instagram-modal';
import { FanPlayers } from '@/components/fan/fan-players';
import { FanSchedule } from '@/components/fan/fan-schedule';
import { FAN_POSITION_ORDER, FanEmpty, FanSectionHeading, FanVideoThumbnail, InstagramGlyph } from '@/components/fan/fan-shared';
import { FanSocial } from '@/components/fan/fan-social';
import { FanVideos } from '@/components/fan/fan-videos';
import { KitschEmptyState } from '@/components/kitsch-empty-state';
import { MinionScreen } from '@/components/minion-screen';
import { getMinionTeam } from '@/constants/teams';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi, resolveApiAssetUrl, type MobileCommunityPostSummary, type MobileMatchSummary, type MobileTeamDetailDto, type MobileTeamFanDto, type MobileTeamFavoriteDto, type MobileTeamNotificationDto } from '@/lib/api-client';
import { fanAccentText, fanHeaderControlColor } from '@/lib/fan-colors';
import { formatTimeKST } from '@/lib/schedule-dates';
import { useAuth } from '@/providers/auth-provider';

export type FanPageSection = 'home' | 'players' | 'schedule' | 'social' | 'videos';

export function FanPage({ section }: { section: FanPageSection }) {
  const params = useLocalSearchParams<{ team?: string | string[] }>();
  const teamSlug = Array.isArray(params.team) ? params.team[0] : params.team;
  const path = teamSlug ? `/api/mobile/v1/teams/${encodeURIComponent(teamSlug)}?section=${section}` : '/api/mobile/v1/teams/__missing__';
  const { data, error, loading, refresh } = useCachedQuery<MobileTeamDetailDto>(path, { enabled: Boolean(teamSlug) });

  if (loading && !data) return <MinionScreen contentStyle={styles.screenContent}><FanLoadingSkeleton section={section} /></MinionScreen>;
  if (error && !data) return <MinionScreen contentStyle={styles.screenContent}><View style={styles.error}><ErrorState onRetry={refresh} title={error} /></View></MinionScreen>;
  if (!data) return <MinionScreen contentStyle={styles.screenContent}><View style={styles.error}><ErrorState onRetry={refresh} title="팀 정보를 찾을 수 없습니다." /></View></MinionScreen>;

  return (
    <MinionScreen contentStyle={styles.screenContent}>
      {section === 'home' ? <FanHome data={data} /> : null}
      {section === 'schedule' ? <FanSchedule data={data} /> : null}
      {section === 'players' ? <FanPlayers players={data.players} team={data.team} /> : null}
      {section === 'social' ? <FanSocial items={data.social} teamName={data.team.shortName} /> : null}
      {section === 'videos' ? <FanVideos items={data.videos} teamName={data.team.shortName} /> : null}
    </MinionScreen>
  );
}

function FanHome({ data }: { data: MobileTeamDetailDto }) {
  const sortedPlayers = useMemo(() => [...data.players].sort((a, b) => FAN_POSITION_ORDER.indexOf(a.position ?? '') - FAN_POSITION_ORDER.indexOf(b.position ?? '')), [data.players]);
  const now = Date.now();
  const matches = data.matches ?? [];
  const upcoming = matches.filter((match) => match.status === 'scheduled' && new Date(match.startsAt).getTime() >= now);
  const completed = matches.filter((match) => match.status === 'completed' || new Date(match.startsAt).getTime() < now).reverse();
  const nextMatch = upcoming[0] ?? completed[0] ?? null;
  return (
    <View style={styles.home}>
      <FanChannelHeader data={data} />
      <View style={styles.homeBody}>
        <View>
          <FanSectionHeading href={`/fan/${data.team.fanSiteHost}/schedule`}>다음 경기</FanSectionHeading>
          {nextMatch ? <FanMatchRow match={nextMatch} teamId={data.team.id} /> : <FanEmpty>등록된 경기가 없습니다.</FanEmpty>}
        </View>
        <HomeCommunityPreview items={data.community ?? []} teamColor={data.team.primaryColor} teamSlug={data.team.fanSiteHost} />
        <HomeSocialPreview items={data.social} teamSlug={data.team.fanSiteHost} />
        <HomeVideoPreview items={data.videos} teamSlug={data.team.fanSiteHost} />
        <HomeRoster players={sortedPlayers.slice(0, 5)} teamColor={data.team.primaryColor} teamSlug={data.team.fanSiteHost} />
      </View>
    </View>
  );
}

function HomeCommunityPreview({ items, teamColor, teamSlug }: { items: MobileTeamDetailDto['community']; teamColor: string; teamSlug: string }) {
  const router = useRouter();
  const { theme } = useMinionTheme();
  return (
    <View>
      <FanSectionHeading href={`/fan/${teamSlug}/community`}>인기글</FanSectionHeading>
      {items.length ? (
        <View style={[styles.communityList, { backgroundColor: theme.surface, borderColor: teamColor }]}>
          {items.slice(0, 6).map((post, index) => (
            <HomeCommunityRow
              key={post.id}
              last={index === Math.min(items.length, 6) - 1}
              onPress={() => router.push(`/fan/${teamSlug}/community/post/${post.id}` as never)}
              post={post}
              teamColor={teamColor}
            />
          ))}
        </View>
      ) : (
        <KitschEmptyState body="화력 좋은 글이 생기면 바로 모아둘게요." character="megapon" compact title="인기글 충전 중" />
      )}
    </View>
  );
}

function HomeCommunityRow({ last, onPress, post, teamColor }: { last: boolean; onPress: () => void; post: MobileCommunityPostSummary; teamColor: string }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const wideMobile = width >= 390;
  const thumbnailUrl = resolveApiAssetUrl(post.thumbnail?.url);
  return (
    <Pressable
      accessibilityLabel={`${post.title} 게시글 보기`}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.communityRow,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderBottomColor: theme.border, minHeight: wideMobile ? 65 : 58 },
        last ? styles.communityRowLast : null,
      ]}
    >
      <View style={styles.communityMain}>
        <View style={styles.communityTitleRow}>
          <Text style={{ color: teamColor, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{boardLabel(post.boardType, 'team')}</Text>
          <View style={[styles.communityHot, { borderColor: teamColor }]}><Text style={{ color: teamColor, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>인기</Text></View>
          <Text numberOfLines={1} style={[styles.communityTitle, { color: theme.ink, ...fonts.medium }]}>{post.title}</Text>
        </View>
        <View style={styles.communityMetaRow}>
          <Text numberOfLines={1} style={[styles.communityAuthor, { color: theme.text, ...fonts.medium }]}>{displayAuthor(post.author)}</Text>
          <Text style={[styles.communityMeta, { color: theme.muted, ...fonts.regular }]}>{formatCommunityDate(post.createdAt)}</Text>
          <View style={styles.communityStat}><MessageCircle color={theme.muted} size={12} strokeWidth={1.8} /><Text style={[styles.communityMeta, { color: theme.muted, ...fonts.regular }]}>{post.commentCount.toLocaleString('ko-KR')}</Text></View>
          <View style={styles.communityStat}><ThumbsUp color={theme.muted} size={12} strokeWidth={1.8} /><Text style={[styles.communityMeta, { color: theme.muted, ...fonts.regular }]}>{post.likeCount.toLocaleString('ko-KR')}</Text></View>
        </View>
      </View>
      {thumbnailUrl ? <Image contentFit="cover" source={{ uri: thumbnailUrl }} style={[styles.communityThumbnail, { backgroundColor: theme.surfaceMuted }, wideMobile ? styles.communityThumbnailWide : null]} transition={150} /> : null}
    </Pressable>
  );
}

function FanChannelHeader({ data }: { data: MobileTeamDetailDto }) {
  const router = useRouter();
  const { colorScheme, favoriteTeam, fonts, setFavoriteTeam, showToast, theme } = useMinionTheme();
  const { refreshViewer, session, viewer } = useAuth();
  const headerUrl = resolveApiAssetUrl(data.headerImage?.url);
  const fanPath = `/api/mobile/v1/teams/${encodeURIComponent(data.team.fanSiteHost)}/fan`;
  const { data: fanState, refresh: refreshFanState } = useCachedQuery<MobileTeamFanDto>(fanPath, { cache: false });
  const [followingOverride, setFollowingOverride] = useState<boolean | null>(null);
  const [countOverride, setCountOverride] = useState<number | null>(null);
  const [notificationOverride, setNotificationOverride] = useState<boolean | null>(null);
  const [pending, setPending] = useState<'favorite' | 'follow' | 'notification' | null>(null);
  const staticTeam = getMinionTeam(data.team.slug) ?? getMinionTeam(data.team.fanSiteHost);
  const favorite = favoriteTeam?.id === data.team.id || favoriteTeam?.slug === data.team.slug || viewer?.favoriteTeamId === data.team.id;
  const following = followingOverride ?? fanState?.following ?? false;
  const fanCount = countOverride ?? fanState?.fanCount ?? 0;
  const notificationEnabled = notificationOverride ?? Boolean(viewer?.followedTeamIds.includes(data.team.id));
  const foreground = headerUrl ? '#ffffff' : theme.ink;
  const controlBackground = theme.surface;
  const controlBorder = theme.border;
  const controlForeground = fanHeaderControlColor(colorScheme === 'dark');
  const teamAccent = fanAccentText(data.team.primaryColor);

  useEffect(() => {
    if (!fanState) return;
    setFollowingOverride(null);
    setCountOverride(null);
  }, [fanState]);

  useEffect(() => {
    if (staticTeam && viewer?.favoriteTeamId === data.team.id && favoriteTeam?.id !== staticTeam.id) setFavoriteTeam(staticTeam);
  }, [data.team.id, favoriteTeam?.id, setFavoriteTeam, staticTeam, viewer?.favoriteTeamId]);

  async function toggleFollow() {
    if (pending) return;
    const next = !following;
    setFollowingOverride(next);
    setCountOverride(Math.max(0, fanCount + (next ? 1 : -1)));
    setPending('follow');
    try {
      const result = await mutateMobileApi<MobileTeamFanDto>(fanPath, 'POST', { following: next });
      setFollowingOverride(result.following);
      setCountOverride(result.fanCount);
      if (!result.following && favorite) setFavoriteTeam(null);
      showToast(result.following ? '팬 등록을 완료했습니다.' : '팬 등록을 해제했습니다.', 'success');
      refreshFanState();
    } catch (caught) {
      setFollowingOverride(null);
      setCountOverride(null);
      showToast(caught instanceof Error ? caught.message : '팬 상태를 바꾸지 못했습니다.', 'error');
    } finally { setPending(null); }
  }

  async function toggleFavorite() {
    if (!staticTeam || pending) return;
    const next = !favorite;
    setPending('favorite');
    try {
      const result = await mutateMobileApi<MobileTeamFavoriteDto>(`/api/mobile/v1/teams/${encodeURIComponent(data.team.fanSiteHost)}/favorite`, 'POST', { favorite: next });
      setFavoriteTeam(result.favorite ? staticTeam : null);
      if (result.favorite) {
        setFollowingOverride(true);
        setCountOverride(following ? fanCount : fanCount + 1);
      }
      await refreshViewer();
      refreshFanState();
      showToast(result.favorite ? `${data.team.shortName}, 내 최애팀` : '최애팀 설정을 해제했습니다.', 'success');
    } catch (caught) { showToast(caught instanceof Error ? caught.message : '최애팀을 설정하지 못했습니다.', 'error'); }
    finally { setPending(null); }
  }

  async function toggleNotification() {
    if (pending) return;
    if (!session) { router.push(`/login?next=/fan/${data.team.fanSiteHost}` as never); return; }
    const next = !notificationEnabled;
    setNotificationOverride(next);
    setPending('notification');
    try {
      const result = await mutateMobileApi<MobileTeamNotificationDto>(`/api/mobile/v1/teams/${encodeURIComponent(data.team.fanSiteHost)}/notifications`, 'POST', { enabled: next });
      setNotificationOverride(result.enabled);
      await refreshViewer();
      showToast(result.enabled ? '새 소식 알림을 켰습니다.' : '새 소식 알림을 껐습니다.', 'success');
    } catch (caught) {
      setNotificationOverride(null);
      showToast(caught instanceof Error ? caught.message : '알림 설정을 바꾸지 못했습니다.', 'error');
    } finally { setPending(null); }
  }

  return (
    <View style={[styles.channelHeader, { borderBottomColor: theme.border, height: headerUrl ? 220 : 132 }]}>
      {headerUrl ? <Image contentFit="cover" contentPosition={{ left: 'center', top: '34%' }} source={{ uri: headerUrl }} style={StyleSheet.absoluteFill} /> : null}
      {headerUrl ? <LinearGradient colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.68)']} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.channelContent}>
        <View style={[styles.channelLogo, { backgroundColor: headerUrl ? '#ffffff' : theme.surface, borderColor: headerUrl ? '#ffffff' : theme.border }]}><TeamLogo plain size={48} team={data.team} themeAware={!headerUrl} /></View>
        <View style={styles.channelInfo}>
          <Text numberOfLines={1} style={[styles.channelTitle, { color: foreground, ...fonts.display }]}>{data.team.shortName} 팬 커뮤니티</Text>
          <View style={styles.headerActions}>
            <HeaderControl accessibilityLabel={following ? `${data.team.shortName} 팔로우 취소` : `${data.team.shortName} 팔로우`} background={controlBackground} border={controlBorder} disabled={Boolean(pending)} onPress={() => void toggleFollow()} wide>
              <Heart color={following ? data.team.primaryColor : controlForeground} fill={following ? data.team.primaryColor : 'none'} size={16} strokeWidth={2.4} />
              <Text style={{ color: following ? data.team.primaryColor : controlForeground, ...fonts.medium, fontSize: 12 }}>{new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1, notation: 'compact' }).format(fanCount)}</Text>
            </HeaderControl>
            <HeaderControl accessibilityLabel={favorite ? `${data.team.shortName} 최애팀 해제` : `${data.team.shortName} 최애팀 설정`} background={controlBackground} border={controlBorder} disabled={!staticTeam || Boolean(pending)} onPress={() => void toggleFavorite()}><Star color={favorite ? teamAccent : controlForeground} fill={favorite ? teamAccent : 'none'} size={17} strokeWidth={2.3} /></HeaderControl>
            <HeaderControl accessibilityLabel={notificationEnabled ? '팬 채널 알림 끄기' : '팬 채널 알림 켜기'} background={controlBackground} border={controlBorder} disabled={Boolean(pending)} onPress={() => void toggleNotification()}><Bell color={notificationEnabled ? data.team.primaryColor : controlForeground} fill={notificationEnabled ? data.team.primaryColor : 'none'} size={16} /></HeaderControl>
            <FanCalendarDialog background={controlBackground} border={controlBorder} events={data.calendarEvents} iconColor={controlForeground} matches={data.matches} teamShort={data.team.shortName} />
          </View>
        </View>
      </View>
    </View>
  );
}

function HeaderControl({ accessibilityLabel, background, border, children, disabled, onPress, wide = false }: { accessibilityLabel: string; background: string; border: string; children: React.ReactNode; disabled?: boolean; onPress: () => void; wide?: boolean }) {
  return <Pressable accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.headerControl, wide ? styles.headerControlWide : null, { backgroundColor: background, borderColor: border, opacity: disabled ? 0.6 : pressed ? 0.8 : 1 }]}>{children}</Pressable>;
}

function FanMatchRow({ match, teamId }: { match: MobileMatchSummary; teamId: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const ownIsA = match.teamA?.id === teamId;
  const opponent = ownIsA ? match.teamB : match.teamA;
  const scheduled = match.status !== 'completed';
  const ownScore = ownIsA ? match.teamAScore : match.teamBScore;
  const opponentScore = ownIsA ? match.teamBScore : match.teamAScore;
  const won = match.winnerTeamId ? match.winnerTeamId === teamId : ownScore !== null && opponentScore !== null ? ownScore > opponentScore : false;
  const badge = scheduled ? '예정' : won ? 'W' : 'L';
  const date = new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'long', timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date(match.startsAt));
  return (
    <Pressable onPress={() => router.navigate(`/matches/${encodeURIComponent(match.id)}` as never)} style={({ pressed }) => [styles.matchRow, { backgroundColor: pressed ? theme.cardHover : theme.surface, borderColor: theme.border }]}>
      <View style={[styles.matchBadge, { backgroundColor: scheduled ? theme.surfaceMuted : won ? dataColor(match, teamId) : theme.muted }]}><Text style={{ color: scheduled ? theme.ink : '#ffffff', ...fonts.medium, fontSize: 12 }}>{badge}</Text></View>
      <TeamLogo size={32} team={opponent} themeAware />
      <View style={styles.matchInfo}>
        <View style={styles.matchTitleRow}><Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.black, fontSize: 14 }}>{opponent?.shortName ?? 'TBD'}</Text>{!scheduled && ownScore !== null && opponentScore !== null ? <Text style={{ color: theme.text, ...fonts.black, fontSize: 14 }}>{ownScore} : {opponentScore}</Text> : null}</View>
        <Text numberOfLines={1} style={{ color: theme.muted, ...fonts.medium, fontSize: 12, lineHeight: 18 }}>{date}{match.name?.trim() ? ` · ${match.name.trim()}` : ''}{scheduled ? ` · ${formatTimeKST(match.startsAt)}` : ''}</Text>
      </View>
      <ChevronRight color={scheduled ? dataColor(match, teamId) : theme.muted} size={14} />
    </Pressable>
  );
}

function dataColor(match: MobileMatchSummary, teamId: string) {
  const team = match.teamA?.id === teamId ? match.teamA : match.teamB;
  return team?.primaryColor ?? '#03de8a';
}

function HomeSocialPreview({ items, teamSlug }: { items: MobileTeamDetailDto['social']; teamSlug: string }) {
  const { width } = useWindowDimensions();
  const { theme } = useMinionTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const cardWidth = (width - 48) / 3;
  const previewItems = items.slice(0, 12);
  return (
    <View>
      <FanSectionHeading href={`/fan/${teamSlug}/social`}>소셜 피드</FanSectionHeading>
      {previewItems.length ? <ScrollView contentContainerStyle={styles.socialRail} horizontal showsHorizontalScrollIndicator={false}>{previewItems.map((item, index) => { const url = resolveApiAssetUrl(item.image?.url); return <Pressable accessibilityLabel={`${item.ownerName} 소셜 게시물`} key={item.id} onPress={() => setOpenIndex(index)} style={[styles.socialCard, { backgroundColor: theme.surfaceMuted, width: cardWidth }]}>{url ? <Image contentFit="cover" source={{ uri: url }} style={StyleSheet.absoluteFill} transition={120} /> : null}<InstagramGlyph color="#ffffff" size={16} style={styles.socialIcon} /></Pressable>; })}</ScrollView> : <FanEmpty>아직 보여줄 소셜 피드가 없습니다.</FanEmpty>}
      {openIndex !== null ? <FanInstagramModal items={previewItems} onClose={() => setOpenIndex(null)} startIndex={openIndex} /> : null}
    </View>
  );
}

function HomeVideoPreview({ items, teamSlug }: { items: MobileTeamDetailDto['videos']; teamSlug: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32) / 1.18;
  return (
    <View>
      <FanSectionHeading href={`/fan/${teamSlug}/videos`}>최신 영상</FanSectionHeading>
      {items.length ? <ScrollView contentContainerStyle={styles.videoRail} horizontal showsHorizontalScrollIndicator={false}>{items.slice(0, 12).map((item) => <Pressable accessibilityLabel={`${item.title} 영상`} key={item.id} onPress={() => router.navigate(`/fan/${teamSlug}/videos` as never)} style={{ width: cardWidth }}><FanVideoThumbnail compact item={item} /></Pressable>)}</ScrollView> : <FanEmpty>등록된 영상이 없습니다.</FanEmpty>}
    </View>
  );
}

function HomeRoster({ players, teamColor, teamSlug }: { players: MobileTeamDetailDto['players']; teamColor: string; teamSlug: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return (
    <View>
      <FanSectionHeading href={`/fan/${teamSlug}/players`}>선수단</FanSectionHeading>
      {players.length ? <ScrollView contentContainerStyle={styles.rosterRail} horizontal showsHorizontalScrollIndicator={false}>{players.map((player) => { const imageUrl = resolveApiAssetUrl(player.profileImage?.url); return <Pressable key={player.id} onPress={() => router.navigate(`/players/${player.slug}` as never)} style={[styles.rosterChip, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.rosterPhoto, { backgroundColor: theme.surfaceMuted }]}>{imageUrl ? <Image contentFit="cover" contentPosition="top" source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} transition={120} /> : <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>{player.name.slice(0, 2)}</Text>}</View><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: 13, maxWidth: '100%' }}>{player.name}</Text><Text style={{ color: teamColor, ...fonts.medium, fontSize: 11 }}>{player.position}</Text></Pressable>; })}</ScrollView> : <FanEmpty>등록된 선수가 없습니다.</FanEmpty>}
    </View>
  );
}

const styles = StyleSheet.create({
  channelContent: { alignItems: 'flex-end', flexDirection: 'row', gap: 16, paddingBottom: 20, paddingHorizontal: 16 },
  channelHeader: { borderBottomWidth: 1, justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' },
  channelInfo: { flex: 1, height: 68, justifyContent: 'center', minWidth: 0 },
  channelLogo: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 68, justifyContent: 'center', width: 68 },
  channelTitle: { fontSize: 24, letterSpacing: -0.84, lineHeight: 26 },
  communityAuthor: { flexShrink: 1, fontSize: 13, lineHeight: 19.5, maxWidth: 112 },
  communityHot: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  communityList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  communityMain: { flex: 1, minWidth: 0 },
  communityMeta: { fontSize: 13, lineHeight: 19.5 },
  communityMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 1, overflow: 'hidden' },
  communityRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 4 },
  communityRowLast: { borderBottomWidth: 0 },
  communityStat: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  communityThumbnail: { borderRadius: 6, height: 51, width: 68 },
  communityThumbnailWide: { borderRadius: 8, height: 57, width: 76 },
  communityTitle: { flex: 1, fontSize: 14, lineHeight: 21 },
  communityTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 0 },
  error: { paddingHorizontal: 16, paddingVertical: 20 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 6 },
  headerControl: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flexDirection: 'row', height: 36, justifyContent: 'center', width: 36 },
  headerControlWide: { gap: 6, paddingHorizontal: 12, width: 'auto' },
  home: { gap: 0 },
  homeBody: { gap: 20, paddingHorizontal: 16, paddingVertical: 20 },
  matchBadge: { alignItems: 'center', borderRadius: 6, height: 32, justifyContent: 'center', width: 40 },
  matchInfo: { flex: 1, minWidth: 0 },
  matchRow: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, height: 56, overflow: 'hidden', paddingHorizontal: 12 },
  matchTitleRow: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  rosterChip: { alignItems: 'center', borderRadius: 12, borderWidth: 1, gap: 3, justifyContent: 'center', minHeight: 96, padding: 8, width: 106 },
  rosterPhoto: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  rosterRail: { gap: 10, paddingBottom: 4 },
  screenContent: { gap: 0, marginTop: 0, paddingHorizontal: 0 },
  socialCard: { aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  socialIcon: { position: 'absolute', right: 8, top: 8 },
  socialRail: { gap: 8 },
  videoRail: { gap: 12 },
});
