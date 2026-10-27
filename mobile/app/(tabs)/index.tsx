import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import { useCallback, useRef } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { boardLabel } from '@/components/community/community-utils';
import { RemoteImage } from '@/components/data/remote-image';
import { TeamLogo } from '@/components/data/team-logo';
import { ErrorState } from '@/components/feedback-states';
import { HomeCelebrationCarousel } from '@/components/home/home-celebration-carousel';
import { HomeNewsSection } from '@/components/home/home-news-section';
import { HomeCalendarDialog } from '@/components/home/home-calendar-dialog';
import { HomeSectionHeading as SectionHeader } from '@/components/home/home-section-heading';
import { HomeTournamentOverview } from '@/components/home/home-tournament-overview';
import { HomeMetaSection, HomeBuildSection } from '@/components/home/home-insights';
import { HomeLoadingSkeleton } from '@/components/home/home-loading-skeleton';
import { KitschEmptyState } from '@/components/kitsch-empty-state';
import { MinionScreen } from '@/components/minion-screen';
import { ContentBanner } from '@/components/ads/content-banner';
import { useScreenQuery } from '@/hooks/use-screen-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileHomeDto, type MobileMatchSummary } from '@/lib/api-client';

const CARD_GAP = 12;
const HOME_TEAM_ORDER = ['t1', 'geng', 'hle', 'dk', 'kt', 'drx', 'ns', 'bro', 'fox', 'soop'];
function matchDate(value: string) {
  const date = new Date(value);
  const monthDay = new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Seoul' }).format(date);
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date);
  return `${monthDay} ${weekday}`;
}

function timeOnly(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return new Intl.DateTimeFormat('ko-KR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { data, error, loading, refresh, refreshControl } = useScreenQuery<MobileHomeDto>('/api/mobile/v1/home', { refreshOnFocus: false });
  const focusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
      } else {
        refresh();
      }
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => subscription.remove();
    }, [refresh]),
  );

  if (loading && !data) return <MinionScreen refreshControl={refreshControl} contentStyle={styles.homeContent}><HomeLoadingSkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen refreshControl={refreshControl}><ErrorState onRetry={refresh} /></MinionScreen>;
  if (!data) return null;

  const contentWidth = width - 32;
  const matchWidth = (contentWidth - CARD_GAP * 0.1) / 1.1;
  const pomWidth = (contentWidth - CARD_GAP * 1.2) / 2.2;


  return (
    <MinionScreen refreshControl={refreshControl} contentStyle={styles.homeContent}>
      <View style={styles.matchSection}>
        <MatchCarousel cardWidth={matchWidth} matches={data.matches} />
        <View style={styles.calendarTrigger}>
          <HomeCalendarDialog calendar={data.calendar} events={data.calendarEvents ?? []} />
        </View>
      </View>
      <HomeCelebrationCarousel events={data.celebrations} />
      <ContentBanner enabled={data.matches.length > 0} />
      <StoveLeagueBanner />
      <View style={styles.section40}><CommunitySection items={data.community} /></View>
      <HomeNewsSection articles={data.news} />
      {(data.pom ?? []).length > 0 ? <View style={styles.section40}><PomSection cardWidth={pomWidth} items={data.pom ?? []} /></View> : null}
      <View style={styles.section40}><TeamChannels teams={data.teams} /></View>
      <View style={styles.section40}><HomeTournamentOverview overview={data.tournamentOverview} /></View>
      <View style={styles.section24}><HomeMetaSection cardWidth={pomWidth} data={data.insights} /></View>
      <View style={styles.section24}><HomeBuildSection cardWidth={pomWidth} data={data.insights} /></View>
    </MinionScreen>
  );
}

function MatchCarousel({ cardWidth, matches }: { cardWidth: number; matches: MobileMatchSummary[] }) {
  return (
    <ScrollView accessibilityLabel="매치 스와이퍼" contentContainerStyle={styles.horizontalContent} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} snapToAlignment="start" snapToInterval={cardWidth + CARD_GAP}>
      {matches.map((match) => <HomeMatchCard cardWidth={cardWidth} key={match.id} match={match} />)}
    </ScrollView>
  );
}

function HomeMatchCard({ cardWidth, match }: { cardWidth: number; match: MobileMatchSummary }) {
  const router = useRouter();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const live = match.status === 'live';
  const fullTournamentName = match.tournament?.name ?? match.name;
  const tournamentName = /demacia|데마시아/i.test(fullTournamentName) ? '데마시아컵' : fullTournamentName;
  const centerLabel = match.status === 'completed' ? `${match.teamAScore ?? 0} : ${match.teamBScore ?? 0}` : timeOnly(match.startsAt);
  return (
    <Pressable onPress={() => router.navigate(`/matches/${encodeURIComponent(match.id)}` as never)} style={[styles.matchCard, { backgroundColor: theme.card, width: cardWidth }]}>
      <View style={styles.matchMetaRow}>
        <View style={styles.tournamentMeta}>{match.tournamentLogo?.url ? <Image contentFit="contain" source={{ uri: resolveApiAssetUrl(match.tournamentLogo.url) ?? undefined }} tintColor={colorScheme === 'dark' ? '#fff' : '#000'} style={styles.tournamentLogo} /> : null}<Text numberOfLines={1} style={[styles.matchMeta, styles.flex, { color: theme.muted, ...fonts.medium }]}>{tournamentName}</Text></View>
        <Text style={[styles.matchMeta, styles.matchDate, { color: theme.muted, ...fonts.medium }]}>{matchDate(match.startsAt)}</Text>
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchSideLeft}><Text numberOfLines={1} style={[styles.matchTeamName, { color: theme.ink, ...fonts.black }]}>{match.teamA?.shortName ?? 'TBD'}</Text><TeamLogo plain size={28} team={match.teamA} themeAware /></View>
        <View style={styles.timePill}>{live ? <View style={styles.liveDot} /> : null}<Text style={{ color: '#fff', ...fonts.medium, fontSize: 12, fontVariant: ['tabular-nums'], lineHeight: 18 }}>{centerLabel}</Text></View>
        <View style={styles.matchSideRight}><TeamLogo plain size={28} team={match.teamB} themeAware /><Text numberOfLines={1} style={[styles.matchTeamName, { color: theme.ink, ...fonts.black }]}>{match.teamB?.shortName ?? 'TBD'}</Text></View>
      </View>
      <View style={styles.oddsArea}><View style={styles.oddsLabels}><Text style={[styles.oddsText, { color: theme.muted, ...fonts.medium }]}>{match.prediction?.teamAPercent ?? 50}%</Text><Text style={[styles.oddsText, { color: theme.muted, ...fonts.medium }]}>{match.prediction?.teamBPercent ?? 50}%</Text></View><View style={[styles.oddsTrack, { backgroundColor: theme.surface }]}><View style={[styles.oddsHalf, { width: `${match.prediction?.teamAPercent ?? 50}%`, backgroundColor: match.teamA?.primaryColor ?? theme.ink }]} /><View style={[styles.oddsHalf, { flex: 1, width: undefined, backgroundColor: match.teamB?.primaryColor ?? theme.muted }]} /></View></View>
    </Pressable>
  );
}

function StoveLeagueBanner() {
  const router = useRouter();
  const { fonts } = useMinionTheme();
  return <Pressable accessibilityRole="link" onPress={() => router.navigate('/transfers' as never)} style={[styles.celebration, { backgroundColor: '#4b22c9' }]}>
    <View style={[styles.celebrationAvatar, { backgroundColor: '#fff' }]}><Image source={require('../../../assets/characters/pen-1.png')} contentFit="contain" style={{ width: 32, height: 32 }} /></View>
    <View style={styles.flex}><Text numberOfLines={1} style={[styles.celebrationTop, { color: '#b9ff66', ...fonts.regular }]}>2026 LCK 스토브리그</Text><Text numberOfLines={1} style={[styles.celebrationTitle, { color: '#fff', ...fonts.display }]}>이적 확정부터 FA 소식까지, 한눈에!</Text></View>
    <View style={styles.celebrationCta}><ChevronRight color="#4b22c9" size={14} strokeWidth={2.5} /></View>
  </Pressable>;
}

function CommunitySection({ items }: { items: MobileHomeDto['community'] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const wideMobile = width >= 390;
  const detailSize = 13;
  const thumbnail = wideMobile ? { height: 57, radius: 8, width: 76 } : { height: 51, radius: 6, width: 68 };
  const title = items.length > 0 && items.every((post) => post.isHot) ? '인기글' : '최신글';
  if (items.length === 0) return <View><SectionHeader title={title} href="/community" /><KitschEmptyState character="megapon" title="인기글 충전 중" body="화력 좋은 글이 생기면 바로 모아둘게요." compact titleStyle={{ ...fonts.bold, fontSize: 16, lineHeight: 24, marginTop: 0 }} bodyStyle={{ fontSize: 16 }} /></View>;
  return <View><SectionHeader action={() => router.navigate((title === '인기글' ? '/community?view=hot' : '/community') as never)} title={title} />{items.map((post) => <Pressable key={post.id} onPress={() => router.push(`/community/post/${post.id}` as never)} style={[styles.postRow, { borderBottomColor: theme.divider, borderBottomWidth: post === items.at(-1) ? 0 : 1, gap: wideMobile ? 12 : 10, minHeight: (wideMobile ? 65 : 58) + (post === items.at(-1) ? 0 : 1) }]}><View style={styles.flex}><View style={styles.postTitleRow}><Text style={{ color: theme.accent, ...fonts.medium, fontSize: detailSize }}>{boardLabel(post.boardType)}</Text>{post.isHot ? <Text style={[styles.hotLabel, { backgroundColor: `${theme.accent}1f`, color: theme.accent, ...fonts.medium, fontSize: detailSize, lineHeight: detailSize }]}>인기</Text> : null}<Text numberOfLines={1} style={[styles.postTitle, { color: theme.ink, ...fonts.medium }]}>{post.title}</Text></View><View style={[styles.postMeta, { gap: wideMobile ? 8 : 6 }]}><Text numberOfLines={1} style={[styles.postMetaText, { maxWidth: 112, flexShrink: 1, color: theme.text, ...fonts.medium, fontSize: detailSize }]}>{post.author.nickname ?? post.author.guestIpLabel ?? '작성자 없음'}</Text><Text style={[styles.postMetaText, { color: theme.muted, ...fonts.regular, fontSize: detailSize }]}>{relativeDate(post.createdAt)}</Text><MessageCircle color={theme.muted} size={11} strokeWidth={1.8} /><Text style={[styles.postMetaText, { color: theme.muted, fontSize: detailSize }]}>{post.commentCount}</Text><ThumbsUp color={theme.muted} size={11} strokeWidth={1.8} /><Text style={[styles.postMetaText, { color: theme.muted, fontSize: detailSize }]}>{post.likeCount}</Text></View></View>{post.thumbnail ? <MediaImage height={thumbnail.height} radius={thumbnail.radius} url={post.thumbnail.url} width={thumbnail.width} /> : null}</Pressable>)}</View>;
}

function PomSection({ cardWidth, items }: { cardWidth: number; items: MobileHomeDto['pom'] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View><SectionHeader action={() => router.navigate('/players')} title="최근 POM" /><ScrollView contentContainerStyle={styles.horizontalContent} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + CARD_GAP}>{items.map((entry) => <Pressable key={entry.matchId} onPress={() => router.navigate(`/matches/${entry.matchId}` as never)} style={[styles.pomCard, { backgroundColor: entry.teamPrimaryColor ? `${entry.teamPrimaryColor}1f` : theme.surfaceMuted, width: cardWidth }]}><Text numberOfLines={1} style={[styles.pomTournament, { ...fonts.medium }]}>{entry.tournamentName}</Text><Image contentFit="cover" contentPosition="top" source={{ uri: resolveApiAssetUrl(entry.playerImage?.url) ?? undefined }} style={styles.pomImage} /><LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']} locations={[0, 0.5, 1]} pointerEvents="none" style={styles.pomGradient} /><View style={styles.pomCopy}><View style={styles.pomNameRow}><Text numberOfLines={1} style={[styles.pomName, { ...fonts.bold }]}>{entry.playerName}</Text><Text style={[styles.pomPosition, { ...fonts.medium }]}>{entry.position}</Text></View><View style={styles.pomTeamRow}><RemoteImage radius={0} size={18} url={entry.teamLogo?.url} /><Text style={[styles.pomTeam, { ...fonts.medium }]}>{entry.teamShortName}</Text>{entry.scoreLabel ? <Text style={[styles.pomScore, { ...fonts.medium }]}>{entry.scoreLabel}</Text> : null}<Text numberOfLines={1} style={[styles.pomOpponent, { ...fonts.medium }]}>{entry.opponentShortName}</Text></View></View></Pressable>)}</ScrollView></View>;
}

function TeamChannels({ teams }: { teams: MobileHomeDto['teams'] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const ordered = HOME_TEAM_ORDER.map((key) => teams.find((team) => team.fanSiteHost === key || team.slug === key)).filter((team): team is NonNullable<typeof team> => Boolean(team));
  return <View><SectionHeader action={() => router.navigate('/teams')} title="팀 채널" /><View style={styles.teamGrid}>{ordered.map((team) => <Pressable accessibilityLabel={`${team.shortName} 팬페이지`} key={team.id} onPress={() => router.navigate(`/fan/${team.fanSiteHost || team.slug}` as never)} style={[styles.teamButton, { width: (width - 64) / 5 }]}><TeamLogo size={44} team={team} themeAware /></Pressable>)}</View></View>;
}

function MediaImage({ height, radius, url, width = '100%' }: { height: number; radius: number; url?: string | null; width?: number | '100%' }) {
  const { theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(url);
  return <Image contentFit="cover" source={uri ? { uri } : undefined} style={{ backgroundColor: theme.surfaceMuted, borderRadius: radius, height, width }} transition={150} />;
}

const styles = StyleSheet.create({
  calendarTrigger: { marginTop: 12 },
  celebration: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 12 },
  celebrationAvatar: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', overflow: 'hidden', width: 36 },
  celebrationCta: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, height: 30, justifyContent: 'center', width: 34 },
  celebrationEmoji: { fontSize: 18, lineHeight: 24 },
  celebrationImage: { height: 36, width: 36 },
  celebrationTitle: { color: '#fff', fontSize: 16, lineHeight: 24 },
  celebrationTop: { fontSize: 13, lineHeight: 16 },
  flex: { flex: 1, minWidth: 0 },
  homeContent: { gap: 0, paddingBottom: 0 },
  horizontalContent: { gap: CARD_GAP, paddingRight: 22 },
  hotLabel: { borderRadius: 999, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  liveDot: { backgroundColor: '#ff3158', borderRadius: 3, height: 6, width: 6 },
  matchCard: { borderRadius: 12, minHeight: 100, padding: 12 },
  matchDate: { marginLeft: 'auto', opacity: 0.75 },
  matchMeta: { fontSize: 13, lineHeight: 19.5 },
  matchMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  matchSection: { marginBottom: 32 },
  matchSideLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'flex-end', minWidth: 0 },
  matchSideRight: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  matchTeamName: { flexShrink: 1, fontSize: 15, lineHeight: 22.5 },
  matchTeams: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 10 },
  oddsArea: { marginTop: 'auto', paddingTop: 8 },
  oddsHalf: { height: 4, width: '50%' },
  oddsLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  oddsText: { fontSize: 13, lineHeight: 19.5, marginBottom: 4 },
  oddsTrack: { borderRadius: 999, flexDirection: 'row', height: 4, overflow: 'hidden' },
  pomCard: { aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden' },
  pomCopy: { bottom: 8, left: 8, minWidth: 0, position: 'absolute', right: 8, zIndex: 3 },
  pomGradient: { bottom: 0, height: '60%', left: 0, position: 'absolute', right: 0, zIndex: 2 },
  pomImage: { height: '100%', marginTop: 16, width: '100%' },
  pomName: { color: '#fff', flexShrink: 1, fontSize: 15, lineHeight: 20 },
  pomNameRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, minWidth: 0 },
  pomOpponent: { color: 'rgba(255,255,255,0.6)', flexShrink: 1, fontSize: 13, lineHeight: 20 },
  pomPosition: { color: 'rgba(255,255,255,0.6)', flexShrink: 0, fontSize: 12, lineHeight: 16 },
  pomScore: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, color: '#fff', fontSize: 12, lineHeight: 16, overflow: 'hidden', paddingHorizontal: 4 },
  pomTeam: { color: '#fff', fontSize: 13, lineHeight: 20 },
  pomTeamRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2, minWidth: 0 },
  pomTournament: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 13, left: 8, lineHeight: 20, maxWidth: '90%', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, position: 'absolute', top: 8, zIndex: 4 },
  postMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 2 },
  postMetaText: { fontSize: 13, lineHeight: 19.5 },
  postRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', paddingVertical: 8 },
  postTitle: { flex: 1, fontSize: 14 },
  postTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  section40: { marginTop: 40 },
  section24: { marginTop: 24 },
  teamButton: { alignItems: 'center' },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timePill: { alignItems: 'center', backgroundColor: '#18191c', borderRadius: 6, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  tournamentLogo: { height: 18, width: 18 },
  tournamentMeta: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
});
