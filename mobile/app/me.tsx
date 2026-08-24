import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Bell from 'lucide-react-native/icons/bell';
import FileText from 'lucide-react-native/icons/file-text';
import LogOut from 'lucide-react-native/icons/log-out';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import Settings from 'lucide-react-native/icons/settings';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MobileMeDto } from '../../packages/contracts/src/mobile-v1';
import { fetchMobileApi, resolveApiAssetUrl } from '@/lib/api-client';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { useAuth } from '@/providers/auth-provider';

export default function MeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionTheme();
  const { loading: authLoading, session, signOut } = useAuth();
  const [data, setData] = useState<MobileMeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setError(null); setData(await fetchMobileApi<MobileMeDto>('/api/mobile/v1/me')); } catch (caught) { setError(caught instanceof Error ? caught.message : '내 정보를 불러오지 못했습니다.'); } }, []);
  useEffect(() => { if (!authLoading && !session) router.replace('/login?next=/me'); else if (session) void load(); }, [authLoading, load, router, session]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  if (authLoading || (session && !data && !error)) return <View style={[styles.center, { backgroundColor: theme.pageBackground }]}><ActivityIndicator color={theme.accent} size="large" /></View>;
  if (!session) return null;
  if (error || !data) return <View style={[styles.center, { backgroundColor: theme.pageBackground, paddingHorizontal: 24 }]}><Text style={{ color: theme.text, fontFamily: fonts.medium, textAlign: 'center' }}>{error}</Text><Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: theme.accent }]}><Text style={{ color: '#061018', fontFamily: fonts.bold }}>다시 시도</Text></Pressable></View>;
  const initials = (data.profile.nickname ?? 'MY').slice(0, 2).toUpperCase();
  return <View style={{ backgroundColor: theme.pageBackground, flex: 1 }}>
    <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: insets.top }]}><Pressable onPress={() => router.back()} style={styles.icon}><ArrowLeft color={theme.ink} size={22} /></Pressable><Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 17 }}>마이 홈</Text><Pressable onPress={() => router.navigate('/me/settings' as never)} style={[styles.icon, { marginLeft: 'auto' }]}><Settings color={theme.ink} size={20} /></Pressable></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={theme.accent} />}>
      <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.accent, { backgroundColor: theme.accent }]} /><View style={[styles.avatar, { backgroundColor: theme.surfaceMuted }]}>{data.profile.profileImage ? <Image contentFit="cover" source={{ uri: resolveApiAssetUrl(data.profile.profileImage.url) ?? undefined }} style={StyleSheet.absoluteFill} /> : <Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 18 }}>{initials}</Text>}</View><View style={styles.flex}><Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13 }}>마이 홈</Text><Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 24 }}>{data.profile.nickname ?? 'MINION 팬'}</Text><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13 }}>{data.profile.tier.toUpperCase()} · {data.profile.lp.toLocaleString('ko-KR')} LP</Text></View></View>
      <View style={styles.stats}><Stat icon={FileText} label="내가 쓴 글" value={data.activity.postCount} /><Stat icon={MessageSquareText} label="내가 쓴 댓글" value={data.activity.commentCount} /></View>
      <Section title="최근 활동">{data.activity.recentPosts.length + data.activity.recentComments.length === 0 ? <Text style={{ color: theme.muted, fontFamily: fonts.medium, paddingVertical: 16 }}>아직 작성한 글이나 댓글이 없어요.</Text> : <>{data.activity.recentPosts.map((item) => <ActivityRow key={`p:${item.id}`} label="작성글" title={item.title} />)}{data.activity.recentComments.map((item) => <ActivityRow key={`c:${item.id}`} label="댓글" title={item.content || '내용 없음'} />)}</>}</Section>
      <Pressable onPress={() => router.navigate('/me/settings' as never)} style={[styles.menu, { borderColor: theme.border }]}><Bell color={theme.muted} size={18} /><Text style={{ color: theme.ink, flex: 1, fontFamily: fonts.bold }}>프로필·알림·팀·차단 설정</Text></Pressable>
      <Pressable onPress={() => void signOut()} style={[styles.menu, { borderColor: theme.border }]}><LogOut color="#dc2626" size={18} /><Text style={{ color: '#dc2626', fontFamily: fonts.bold }}>로그아웃</Text></Pressable>
    </ScrollView>
  </View>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) { const { fonts, theme } = useMinionTheme(); return <View style={[styles.stat, { backgroundColor: theme.surfaceMuted }]}><Icon color={theme.muted} size={17} /><View><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>{label}</Text><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 20 }}>{value}</Text></View></View>; }
function Section({ children, title }: { children: React.ReactNode; title: string }) { const { fonts, theme } = useMinionTheme(); return <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 17 }}>{title}</Text>{children}</View>; }
function ActivityRow({ label, title }: { label: string; title: string }) { const { fonts, theme } = useMinionTheme(); return <View style={[styles.activity, { borderTopColor: theme.divider }]}><Text style={{ color: theme.accent, fontFamily: fonts.bold, fontSize: 12 }}>{label}</Text><Text numberOfLines={1} style={{ color: theme.text, flex: 1, fontFamily: fonts.medium, fontSize: 14 }}>{title}</Text></View>; }
const styles = StyleSheet.create({ center: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center' }, header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: 8 }, icon: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, content: { gap: 14, padding: 16 }, hero: { alignItems: 'center', borderRadius: 24, borderWidth: 1, flexDirection: 'row', gap: 14, overflow: 'hidden', padding: 20 }, accent: { height: 4, left: 0, position: 'absolute', right: 0, top: 0 }, avatar: { alignItems: 'center', borderRadius: 28, height: 56, justifyContent: 'center', overflow: 'hidden', width: 56 }, flex: { flex: 1, gap: 3 }, stats: { flexDirection: 'row', gap: 10 }, stat: { alignItems: 'center', borderRadius: 14, flex: 1, flexDirection: 'row', gap: 10, padding: 14 }, section: { borderRadius: 16, borderWidth: 1, padding: 18 }, activity: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 10, minHeight: 52 }, menu: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 54, paddingHorizontal: 16 }, retry: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 } });
