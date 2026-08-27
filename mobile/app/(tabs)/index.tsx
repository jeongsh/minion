import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Play from 'lucide-react-native/icons/play';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RemoteImage } from '@/components/data/remote-image';
import { TeamLogo } from '@/components/data/team-logo';
import { ErrorState } from '@/components/feedback-states';
import { HomeCalendarDialog } from '@/components/home/home-calendar-dialog';
import { HomeLoadingSkeleton } from '@/components/home/home-loading-skeleton';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileHomeDto, type MobileMatchSummary, type MobileNewsItem, type MobileVideoItem } from '@/lib/api-client';

const CARD_GAP = 12;
const LCK_LOGO = require('@/assets/images/lck.svg');
const LCK_LOGO_DARK = require('@/assets/images/lck-dark.svg');
const BOARD_LABELS: Record<string, string> = { free: '자유', live: '실시간', humor: '유머', information: '정보', question: '질문' };
const HOME_TEAM_ORDER = ['t1', 'geng', 'hle', 'dk', 'kt', 'drx', 'ns', 'bro', 'fox', 'soop'];
type CelebrationEvent = MobileHomeDto['celebrations'][number];
type CelebrationType = CelebrationEvent['type'];

const CELEBRATION_EMOJI: Record<CelebrationType, string> = { birthday: '🎂', championship: '🏆', custom: '🎈', debut: '🎉' };
const CELEBRATION_THEME: Record<CelebrationType, { accent: string; background: string; foreground: string; soft: string }> = {
  birthday: { accent: '#d4ff3d', background: '#304ffe', foreground: '#ffffff', soft: '#556ffe' },
  debut: { accent: '#e4ddff', background: '#7c5cff', foreground: '#ffffff', soft: '#927dff' },
  championship: { accent: '#5a4600', background: '#f5c518', foreground: '#211a00', soft: '#ffe46b' },
  custom: { accent: '#5a4600', background: '#f5c518', foreground: '#211a00', soft: '#ffe46b' },
};

function newsDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', hour: '2-digit', hour12: false, minute: '2-digit', month: 'long', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

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
  const { data, error, loading, refresh } = useCachedQuery<MobileHomeDto>('/api/mobile/v1/home');
  if (loading && !data) return <MinionScreen contentStyle={styles.homeContent}><HomeLoadingSkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen><ErrorState onRetry={refresh} /></MinionScreen>;
  if (!data) return null;

  const contentWidth = width - 32;
  const matchWidth = (contentWidth - CARD_GAP * 0.1) / 1.1;
  const pomWidth = (contentWidth - CARD_GAP * 1.2) / 2.2;
  const videoWidth = (contentWidth - CARD_GAP * 0.18) / 1.18;

  return (
    <MinionScreen contentStyle={styles.homeContent}>
      <View style={styles.matchSection}>
        <MatchCarousel cardWidth={matchWidth} matches={data.matches} />
        <View style={styles.calendarTrigger}>
          <HomeCalendarDialog calendar={data.calendar} events={data.calendarEvents ?? []} />
        </View>
      </View>
      {data.celebrations.length > 0 ? <View style={styles.celebrations}>{data.celebrations.map((event) => <CelebrationBanner event={event} key={event.id} />)}</View> : null}
      <NewsSection contentWidth={contentWidth} items={data.news} />
      <View style={styles.adAfterNews}><AdPlaceholder /></View>
      <View style={styles.section40}><CommunitySection items={data.community} /></View>
      {(data.pom ?? []).length > 0 ? <View style={styles.section40}><PomSection cardWidth={pomWidth} items={data.pom ?? []} /></View> : null}
      <View style={styles.section40}><TeamChannels teams={data.teams} /></View>
      <View style={styles.section40}><VideoSection cardWidth={videoWidth} items={data.videos} /><View style={styles.videoAd}><AdPlaceholder /></View></View>
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
  const tournamentName = match.tournament?.name ?? match.name;
  const kespa = tournamentName.toLocaleLowerCase('ko-KR').includes('kespa');
  const centerLabel = match.status === 'completed' ? `${match.teamAScore ?? 0} : ${match.teamBScore ?? 0}` : timeOnly(match.startsAt);
  return (
    <Pressable onPress={() => router.navigate(`/matches/${encodeURIComponent(match.id)}` as never)} style={[styles.matchCard, { backgroundColor: theme.card, width: cardWidth }]}>
      <View style={styles.matchMetaRow}>
        <View style={styles.tournamentMeta}><Image contentFit="contain" source={kespa ? { uri: resolveApiAssetUrl('/logos/tournaments/kespa-cup.webp') ?? undefined } : colorScheme === 'dark' ? LCK_LOGO_DARK : LCK_LOGO} style={styles.tournamentLogo} /><Text numberOfLines={1} style={[styles.matchMeta, styles.flex, { color: theme.muted, ...fonts.medium }]}>{tournamentName}</Text></View>
        <Text style={[styles.matchMeta, styles.matchDate, { color: theme.muted, ...fonts.medium }]}>{matchDate(match.startsAt)}</Text>
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchSideLeft}><Text numberOfLines={1} style={[styles.matchTeamName, { color: theme.ink, ...fonts.black }]}>{match.teamA?.shortName ?? 'TBD'}</Text><TeamLogo plain size={28} team={match.teamA} themeAware /></View>
        <View style={styles.timePill}>{live ? <View style={styles.liveDot} /> : null}<Text style={{ color: '#fff', ...fonts.medium, fontSize: 12, fontVariant: ['tabular-nums'], lineHeight: 18 }}>{centerLabel}</Text></View>
        <View style={styles.matchSideRight}><TeamLogo plain size={28} team={match.teamB} themeAware /><Text numberOfLines={1} style={[styles.matchTeamName, { color: theme.ink, ...fonts.black }]}>{match.teamB?.shortName ?? 'TBD'}</Text></View>
      </View>
      <View style={styles.oddsArea}><View style={styles.oddsLabels}><Text style={[styles.oddsText, { color: theme.muted, ...fonts.medium }]}>50%</Text><Text style={[styles.oddsText, { color: theme.muted, ...fonts.medium }]}>50%</Text></View><View style={[styles.oddsTrack, { backgroundColor: theme.surface }]}><View style={[styles.oddsHalf, { backgroundColor: match.teamA?.primaryColor ?? '#b49b57' }]} /><View style={[styles.oddsHalf, { backgroundColor: match.teamB?.primaryColor ?? '#ef3340' }]} /></View></View>
    </Pressable>
  );
}

function CelebrationBanner({ event }: { event: CelebrationEvent }) {
  const router = useRouter();
  const { fonts } = useMinionTheme();
  const nth = event.yearsCount ? `${event.yearsCount}번째 ` : '';
  const palette = CELEBRATION_THEME[event.type];
  const imageUrl = resolveApiAssetUrl(event.image?.url);
  return (
    <Pressable onPress={() => event.teamSlug ? router.navigate(`/fan/${event.teamSlug}/community` as never) : router.navigate('/community')} style={[styles.celebration, { backgroundColor: palette.background }]}>
      <View style={[styles.celebrationAvatar, { backgroundColor: palette.soft }]}>{imageUrl ? <Image contentFit="cover" contentPosition="top" source={{ uri: imageUrl }} style={styles.celebrationImage} /> : <Text style={styles.celebrationEmoji}>{CELEBRATION_EMOJI[event.type]}</Text>}</View>
      <View style={styles.flex}><Text numberOfLines={1} style={[styles.celebrationTop, { color: palette.accent, ...fonts.regular }]}>{event.type === 'birthday' ? `오늘은 ${event.subjectName} 선수의 ${nth}생일!` : `오늘은 ${event.title}!`}</Text><Text numberOfLines={1} style={[styles.celebrationTitle, { color: palette.foreground, ...fonts.display }]}>{event.teamShort ? `${event.teamShort} 커뮤니티에서 함께 축하해요` : '커뮤니티에서 함께 축하해요'}</Text></View>
      <View style={styles.celebrationCta}><ChevronRight color={palette.background} size={14} strokeWidth={2.5} /></View>
    </Pressable>
  );
}

function SectionHeader({ action, title }: { action?: () => void; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.ink, ...fonts.display }]}>{title}</Text>{action ? <Pressable onPress={action} style={styles.sectionAction}><Text style={[styles.sectionActionText, { color: theme.muted, ...fonts.bold }]}>전체보기</Text><ChevronRight color={theme.muted} size={16} /></Pressable> : null}</View>;
}

function isOsenArticle(article: MobileNewsItem) {
  if (article.source.trim().toLocaleLowerCase('ko-KR') === 'osen') return true;
  try {
    const hostname = new URL(article.url).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'osen.co.kr' || hostname.endsWith('.osen.co.kr');
  } catch {
    return false;
  }
}

function NewsSection({ contentWidth, items }: { contentWidth: number; items: MobileNewsItem[] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const lead = items.find((article) => !isOsenArticle(article));
  if (!lead) return null;
  const secondary = items.filter((article) => article.id !== lead.id).slice(0, 3);
  return <View><SectionHeader action={() => router.navigate('/news')} title="LCK 뉴스" /><View style={styles.newsGrid}><Pressable onPress={() => void Linking.openURL(lead.url)}><MediaImage height={contentWidth * 9 / 16} radius={8} url={lead.thumbnail?.url} /><Text numberOfLines={2} style={[styles.leadTitle, { color: theme.ink, ...fonts.display }]}>{lead.title}</Text><View style={styles.leadMeta}><Text numberOfLines={1} style={[styles.newsSource, { color: theme.ink, ...fonts.medium }]}>{lead.source}</Text><Text style={[styles.newsMetaDot, { color: theme.muted, ...fonts.medium }]}>·</Text><Text style={[styles.newsMetaText, { color: theme.muted, ...fonts.medium }]}>{newsDate(lead.publishedAt)}</Text></View></Pressable><View>{secondary.map((article, index) => <Pressable key={article.id} onPress={() => void Linking.openURL(article.url)} style={[styles.newsRow, index === 0 && styles.newsRowFirst, index === secondary.length - 1 && styles.newsRowLast, { borderBottomColor: theme.divider }]}><MediaImage height={58.5} radius={8} url={article.thumbnail?.url} width={104} /><View style={styles.newsRowCopy}><Text numberOfLines={2} style={[styles.rowTitle, { color: theme.ink, ...fonts.display }]}>{article.title}</Text><View style={styles.rowMeta}><Text numberOfLines={1} style={[styles.newsMetaText, styles.newsRowSource, { color: theme.muted, ...fonts.medium }]}>{article.source}</Text><Text style={[styles.newsMetaDot, { color: theme.muted, ...fonts.medium }]}>·</Text><Text style={[styles.newsMetaText, { color: theme.muted, ...fonts.medium }]}>{newsDate(article.publishedAt)}</Text></View></View></Pressable>)}</View></View></View>;
}

function AdPlaceholder() {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.ad, { backgroundColor: theme.adSurface }]}><Text style={styles.adText}><Text style={{ ...fonts.medium }}>ADVERTISEMENT</Text></Text></View>;
}

function CommunitySection({ items }: { items: MobileHomeDto['community'] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const wideMobile = width >= 390;
  const detailSize = 13;
  const thumbnail = wideMobile ? { height: 57, radius: 8, width: 76 } : { height: 51, radius: 6, width: 68 };
  const title = items.length > 0 && items.every((post) => post.isHot) ? '인기글' : '최신글';
  return <View><SectionHeader action={() => router.navigate('/community')} title={title} />{items.map((post) => <Pressable key={post.id} onPress={() => router.push(`/community/post/${post.id}` as never)} style={[styles.postRow, { borderBottomColor: theme.divider, gap: wideMobile ? 12 : 10, minHeight: wideMobile ? 65 : 58 }]}><View style={styles.flex}><View style={styles.postTitleRow}><Text style={{ color: theme.accent, ...fonts.medium, fontSize: detailSize }}>{BOARD_LABELS[post.boardType] ?? post.boardType}</Text>{post.isHot ? <Text style={[styles.hotLabel, { backgroundColor: `${theme.accent}1f`, color: theme.accent, ...fonts.medium, fontSize: detailSize, lineHeight: detailSize }]}>인기</Text> : null}<Text numberOfLines={1} style={[styles.postTitle, { color: theme.ink, ...fonts.medium }]}>{post.title}</Text></View><View style={[styles.postMeta, { gap: wideMobile ? 8 : 6 }]}><Text numberOfLines={1} style={[styles.postMetaText, { color: theme.text, ...fonts.medium, fontSize: detailSize }]}>{post.author.nickname ?? post.author.guestIpLabel ?? '작성자 없음'}</Text><Text style={[styles.postMetaText, { color: theme.muted, ...fonts.regular, fontSize: detailSize }]}>{relativeDate(post.createdAt)}</Text><MessageCircle color={theme.muted} size={11} strokeWidth={1.8} /><Text style={[styles.postMetaText, { color: theme.muted, fontSize: detailSize }]}>{post.commentCount}</Text><ThumbsUp color={theme.muted} size={11} strokeWidth={1.8} /><Text style={[styles.postMetaText, { color: theme.muted, fontSize: detailSize }]}>{post.likeCount}</Text></View></View>{post.thumbnail ? <MediaImage height={thumbnail.height} radius={thumbnail.radius} url={post.thumbnail.url} width={thumbnail.width} /> : null}</Pressable>)}</View>;
}

function PomSection({ cardWidth, items }: { cardWidth: number; items: MobileHomeDto['pom'] }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View><SectionHeader action={() => router.navigate('/players')} title="최근 POM" /><ScrollView contentContainerStyle={styles.horizontalContent} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + CARD_GAP}>{items.map((entry) => <Pressable key={entry.matchId} onPress={() => router.navigate(`/players/${entry.playerSlug}` as never)} style={[styles.pomCard, { backgroundColor: entry.teamPrimaryColor ? `${entry.teamPrimaryColor}1f` : theme.surfaceMuted, width: cardWidth }]}><Text numberOfLines={1} style={[styles.pomTournament, { ...fonts.medium }]}>{entry.tournamentName}</Text><Image contentFit="cover" contentPosition="top" source={{ uri: resolveApiAssetUrl(entry.playerImage?.url) ?? undefined }} style={styles.pomImage} /><LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']} locations={[0, 0.5, 1]} pointerEvents="none" style={styles.pomGradient} /><View style={styles.pomCopy}><View style={styles.pomNameRow}><Text numberOfLines={1} style={[styles.pomName, { ...fonts.bold }]}>{entry.playerName}</Text><Text style={[styles.pomPosition, { ...fonts.medium }]}>{entry.position}</Text></View><View style={styles.pomTeamRow}><RemoteImage radius={0} size={18} url={entry.teamLogo?.url} /><Text style={[styles.pomTeam, { ...fonts.medium }]}>{entry.teamShortName}</Text>{entry.scoreLabel ? <Text style={[styles.pomScore, { ...fonts.medium }]}>{entry.scoreLabel}</Text> : null}<Text numberOfLines={1} style={[styles.pomOpponent, { ...fonts.medium }]}>{entry.opponentShortName}</Text></View></View></Pressable>)}</ScrollView></View>;
}

function TeamChannels({ teams }: { teams: MobileHomeDto['teams'] }) {
  const router = useRouter();
  const ordered = HOME_TEAM_ORDER.map((key) => teams.find((team) => team.fanSiteHost === key || team.slug === key)).filter((team): team is NonNullable<typeof team> => Boolean(team));
  return <View><SectionHeader action={() => router.navigate('/teams')} title="팀 채널" /><View style={styles.teamGrid}>{ordered.map((team) => <Pressable accessibilityLabel={`${team.shortName} 팬페이지`} key={team.id} onPress={() => router.navigate(`/fan/${team.fanSiteHost || team.slug}` as never)} style={styles.teamButton}><TeamLogo size={44} team={team} themeAware /></Pressable>)}</View></View>;
}

function VideoSection({ cardWidth, items }: { cardWidth: number; items: MobileVideoItem[] }) {
  const { fonts, theme } = useMinionTheme();
  return <View><SectionHeader title="최신 영상" /><ScrollView contentContainerStyle={styles.horizontalContent} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + CARD_GAP}>{items.map((video) => <Pressable key={video.id} onPress={() => void Linking.openURL(video.url)} style={{ width: cardWidth }}><View><MediaImage height={cardWidth * 9 / 16} radius={16} url={video.thumbnail?.url} width={cardWidth} /><LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} pointerEvents="none" style={styles.videoGradient} /><View style={[styles.playButton, { backgroundColor: theme.accent }]}><Play color="#061018" fill="#061018" size={16} /></View></View><Text numberOfLines={2} style={[styles.videoTitle, { color: theme.ink, ...fonts.bold }]}>{video.title}</Text><View style={[styles.channelPill, { borderColor: theme.muted }]}><Text style={[styles.channelText, { color: theme.muted, ...fonts.medium }]}>{video.channelName ?? 'LCK'}</Text></View></Pressable>)}</ScrollView></View>;
}

function MediaImage({ height, radius, url, width = '100%' }: { height: number; radius: number; url?: string | null; width?: number | '100%' }) {
  const { theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(url);
  return <Image contentFit="cover" source={uri ? { uri } : undefined} style={{ backgroundColor: theme.surfaceMuted, borderRadius: radius, height, width }} transition={150} />;
}

const styles = StyleSheet.create({
  ad: { alignItems: 'center', borderRadius: 16, height: 100, justifyContent: 'center' },
  adAfterNews: { marginTop: 32 },
  adText: { color: '#96999f', fontSize: 11, letterSpacing: 1.98 },
  calendarTrigger: { marginTop: 12 },
  celebration: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 12 },
  celebrationAvatar: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', overflow: 'hidden', width: 36 },
  celebrations: { gap: 10, marginBottom: 32 },
  celebrationCta: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, height: 30, justifyContent: 'center', width: 34 },
  celebrationEmoji: { fontSize: 18, lineHeight: 24 },
  celebrationImage: { height: 36, width: 36 },
  celebrationTitle: { color: '#fff', fontSize: 14, lineHeight: 20 },
  celebrationTop: { fontSize: 13, lineHeight: 16 },
  channelPill: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, marginTop: 8, paddingHorizontal: 8, paddingVertical: 2 },
  channelText: { fontSize: 12, lineHeight: 16 },
  flex: { flex: 1, minWidth: 0 },
  homeContent: { gap: 0, paddingBottom: 0 },
  horizontalContent: { gap: CARD_GAP, paddingRight: 22 },
  hotLabel: { borderRadius: 999, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  leadMeta: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 8 },
  leadTitle: { fontSize: 14, letterSpacing: -0.49, lineHeight: 19.6, marginTop: 10 },
  liveDot: { backgroundColor: '#ff3158', borderRadius: 3, height: 6, width: 6 },
  matchCard: { borderRadius: 12, minHeight: 100, padding: 12 },
  matchDate: { marginLeft: 'auto', opacity: 0.75 },
  matchMeta: { fontSize: 11, lineHeight: 16.5 },
  matchMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  matchSection: { marginBottom: 32 },
  matchSideLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'flex-end', minWidth: 0 },
  matchSideRight: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  matchTeamName: { flexShrink: 1, fontSize: 15, lineHeight: 22.5 },
  matchTeams: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 10 },
  newsGrid: { gap: 20 },
  newsMetaDot: { fontSize: 12, lineHeight: 18 },
  newsMetaText: { fontSize: 12, lineHeight: 18 },
  newsRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 },
  newsRowFirst: { paddingTop: 0 },
  newsRowCopy: { alignSelf: 'stretch', flex: 1, minWidth: 0 },
  newsRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  newsRowSource: { flexShrink: 1, minWidth: 0 },
  newsSource: { fontSize: 12, lineHeight: 18 },
  oddsArea: { marginTop: 'auto', paddingTop: 8 },
  oddsHalf: { height: 4, width: '50%' },
  oddsLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  oddsText: { fontSize: 10, lineHeight: 15, marginBottom: 4 },
  oddsTrack: { borderRadius: 999, flexDirection: 'row', height: 4, overflow: 'hidden' },
  playButton: { alignItems: 'center', borderRadius: 18, bottom: 12, height: 36, justifyContent: 'center', left: 12, position: 'absolute', width: 36 },
  pomCard: { aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden' },
  pomCopy: { bottom: 8, left: 8, minWidth: 0, position: 'absolute', right: 8, zIndex: 3 },
  pomGradient: { bottom: 0, height: '60%', left: 0, position: 'absolute', right: 0, zIndex: 2 },
  pomImage: { height: '100%', marginTop: 16, width: '100%' },
  pomName: { color: '#fff', flexShrink: 1, fontSize: 14, lineHeight: 20 },
  pomNameRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, minWidth: 0 },
  pomOpponent: { color: 'rgba(255,255,255,0.6)', flexShrink: 1, fontSize: 11, lineHeight: 16 },
  pomPosition: { color: 'rgba(255,255,255,0.6)', flexShrink: 0, fontSize: 10, lineHeight: 16 },
  pomScore: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, color: '#fff', fontSize: 10, lineHeight: 16, overflow: 'hidden', paddingHorizontal: 4 },
  pomTeam: { color: '#fff', fontSize: 11, lineHeight: 16 },
  pomTeamRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2, minWidth: 0 },
  pomTournament: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 10, left: 8, lineHeight: 16, maxWidth: '90%', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, position: 'absolute', top: 8, zIndex: 4 },
  postMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 2 },
  postMetaText: { fontSize: 12, lineHeight: 16 },
  postRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', paddingVertical: 8 },
  postTitle: { flex: 1, fontSize: 14 },
  postTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  rowMeta: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 'auto', paddingTop: 4 },
  rowTitle: { fontSize: 14, letterSpacing: -0.28, lineHeight: 20.3 },
  section40: { marginTop: 40 },
  sectionAction: { alignItems: 'center', flexDirection: 'row' },
  sectionActionText: { fontSize: 14, lineHeight: 20 },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, lineHeight: 21.6 },
  teamButton: { alignItems: 'center', width: '20%' },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  timePill: { alignItems: 'center', backgroundColor: '#18191c', borderRadius: 6, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  tournamentLogo: { height: 18, width: 18 },
  tournamentMeta: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  videoAd: { marginTop: 40 },
  videoGradient: { bottom: 0, height: '45%', left: 0, position: 'absolute', right: 0 },
  videoTitle: { fontSize: 14, lineHeight: 20, marginTop: 12 },
});
