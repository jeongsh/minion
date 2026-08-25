import { useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import FileText from 'lucide-react-native/icons/file-text';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import LogOut from 'lucide-react-native/icons/log-out';
import ShieldBan from 'lucide-react-native/icons/shield-ban';
import UserRound from 'lucide-react-native/icons/user-round';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { MobileMeDto, MobileNotificationPreferences } from '../../packages/contracts/src/mobile-v1';
import { AccountSecuritySection, BlockedSection, NotificationSection } from '@/components/account/account-sections';
import { ProfileForm } from '@/components/account/profile-form';
import { MinionDock } from '@/components/minion-dock';
import { MinionScreen } from '@/components/minion-screen';
import { RankAvatar } from '@/components/rank-avatar';
import { fetchMobileApi, mutateMobileApi, uploadMobileApi } from '@/lib/api-client';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { useAuth } from '@/providers/auth-provider';

type SectionKey = 'profile' | 'notifications' | 'blocks' | 'account';
const menuItems = [
  { key: 'profile' as const, label: '프로필', icon: UserRound }, { key: 'notifications' as const, label: '알림', icon: Bell },
  { key: 'blocks' as const, label: '차단 관리', icon: ShieldBan }, { key: 'account' as const, label: '계정·보안', icon: LockKeyhole },
];
const providerLabels: Record<string, string> = { google: '구글', kakao: '카카오', 'custom:naver': '네이버', apple: 'Apple' };

export default function MeScreen() {
  const router = useRouter();
  const { fonts, showToast, theme } = useMinionTheme();
  const { loading: authLoading, refreshViewer, session, signInWithOAuth, signOut } = useAuth();
  const [data, setData] = useState<MobileMeDto | null>(null); const [error, setError] = useState<string | null>(null); const [checkingIn, setCheckingIn] = useState(false);
  const [sectionPositions, setSectionPositions] = useState<Partial<Record<SectionKey, number>>>({}); const [scrollRequest, setScrollRequest] = useState<{ animated: boolean; y: number } | null>(null);
  const load = useCallback(async () => { try { setError(null); setData(await fetchMobileApi<MobileMeDto>('/api/mobile/v1/me')); } catch (caught) { setError(caught instanceof Error ? caught.message : '내 정보를 불러오지 못했습니다.'); } }, []);
  useEffect(() => { if (authLoading) return; if (!session) router.replace('/login?next=/me'); else void load(); }, [authLoading, load, router, session]);
  if (!session && !authLoading) return null;

  const updateData = async (payload: unknown, success?: string) => { const next = await mutateMobileApi<MobileMeDto>('/api/mobile/v1/me', 'PATCH', payload); setData(next); await refreshViewer(); if (success) showToast(success, 'success'); return next; };
  const saveProfile = async (formData: FormData) => { const next = await uploadMobileApi<MobileMeDto>('/api/mobile/v1/me', formData); setData(next); await refreshViewer(); return next; };
  const checkIn = async () => { if (!data || data.rank.checkedInToday || checkingIn) return; setCheckingIn(true); try { await updateData({ checkIn: true }, '출석 도장 쾅! +100 LP'); } catch (caught) { showToast(caught instanceof Error ? caught.message : '출석체크에 실패했습니다.', 'error'); await load(); } finally { setCheckingIn(false); } };
  const navigateSection = (key: SectionKey) => { const y = sectionPositions[key]; if (y !== undefined) setScrollRequest({ animated: true, y: Math.max(0, y + 105) }); };
  const sectionLayout = (key: SectionKey) => (event: LayoutChangeEvent) => setSectionPositions((current) => ({ ...current, [key]: event.nativeEvent.layout.y }));

  return <View style={[styles.root, { backgroundColor: theme.pageBackground }]}><MinionScreen contentStyle={styles.content} scrollRequest={scrollRequest}>
    {authLoading || (!data && !error) ? <AccountSkeleton /> : error || !data ? <View style={[styles.errorCard, { borderColor: theme.border }]}><Text style={{ color: theme.text, fontFamily: fonts.medium, textAlign: 'center' }}>{error}</Text><Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: theme.accent }]}><Text style={{ color: theme.accentForeground, fontFamily: fonts.bold }}>다시 시도</Text></Pressable></View> : <>
      <AccountSummary checkingIn={checkingIn} data={data} onCheckIn={() => void checkIn()} onLogout={() => void signOut()} onOpenActivity={() => router.navigate('/community' as never)} />
      <View accessibilityRole="tablist" style={styles.menuGrid}>{menuItems.map(({ icon: Icon, key, label }) => <Pressable accessibilityRole="tab" key={key} onPress={() => navigateSection(key)} style={[styles.menuItem, { backgroundColor: theme.surfaceMuted }]}><Icon color={theme.muted} size={14} /><Text numberOfLines={1} style={{ color: theme.text, fontFamily: fonts.medium, fontSize: 12 }}>{label}</Text></Pressable>)}</View>
      <View onLayout={sectionLayout('profile')}><ProfileForm initialProfile={data.profile} onSave={saveProfile} /></View>
      <View onLayout={sectionLayout('notifications')}><NotificationSection initialPreferences={data.notificationPreferences} onSave={async (preferences: MobileNotificationPreferences) => { await updateData({ notificationPreferences: preferences }, '변경한 설정을 적용했어요.'); }} /></View>
      <View onLayout={sectionLayout('blocks')}><BlockedSection blockedGuests={data.blockedGuests} blockedUsers={data.blockedUsers} onUnblockGuest={async (guestKey) => { await updateData({ unblockGuestKey: guestKey }, '차단을 해제했습니다.'); }} onUnblockUser={async (userId) => { await updateData({ unblockUserId: userId }, '차단을 해제했습니다.'); }} /></View>
      <View onLayout={sectionLayout('account')}><AccountSecuritySection account={data.account} authProvider={data.profile.authProvider} email={data.profile.email} onChangePassword={async (input) => { await updateData({ passwordChange: input }); }} onDelete={async (input) => { await mutateMobileApi<{ deleted: boolean }>('/api/mobile/v1/me', 'DELETE', input); await signOut(); }} onReauthenticate={async () => { const provider = data.profile.authProvider === 'custom:naver' ? 'naver' : data.profile.authProvider; if (!provider || !['google', 'kakao', 'apple', 'naver'].includes(provider)) throw new Error('연결된 로그인 방식을 확인할 수 없습니다.'); const result = await signInWithOAuth(provider as 'google' | 'kakao' | 'apple' | 'naver', '/me'); if (result.error) throw new Error(result.error); }} /></View>
    </>}
  </MinionScreen><MinionDock /></View>;
}

function AccountSummary({ checkingIn, data, onCheckIn, onLogout, onOpenActivity }: { checkingIn: boolean; data: MobileMeDto; onCheckIn: () => void; onLogout: () => void; onOpenActivity: () => void }) {
  const { fonts, theme } = useMinionTheme(); const initials = (data.profile.nickname ?? 'MY').slice(0, 2).toUpperCase(); const provider = data.profile.authProvider ? providerLabels[data.profile.authProvider] : undefined; const accountLabel = data.account.hasPassword ? data.profile.email ?? '이메일 정보 없음' : `${provider ?? '소셜'} 로그인`;
  return <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.summaryRow}><RankAvatar fallback={initials} profileImageUrl={data.profile.profileImage?.url} size="mobile" tier={data.profile.tier} /><View style={styles.summaryCopy}><Text numberOfLines={1} style={[styles.nickname, { color: theme.ink, fontFamily: fonts.black }]}>{data.profile.nickname ?? 'MINION 팬'}</Text><Text numberOfLines={1} style={[styles.account, { color: theme.muted, fontFamily: fonts.medium }]}>{accountLabel}</Text><View style={styles.rankLine}><Text style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 12 }}>{data.rank.progressLabel}</Text><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>{data.profile.lp.toLocaleString('ko-KR')} LP</Text>{data.rank.overallRank ? <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>전체 {data.rank.overallRank.toLocaleString('ko-KR')}위</Text> : null}</View></View></View><View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}><View style={[styles.progressBar, { backgroundColor: theme.accent, width: `${Math.round(data.rank.progressRatio * 100)}%` }]} /></View><Pressable disabled={checkingIn || data.rank.checkedInToday} onPress={onCheckIn} style={[styles.checkIn, { backgroundColor: theme.accent, opacity: data.rank.checkedInToday ? 0.7 : 1 }]}>{checkingIn ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={{ color: theme.accentForeground, fontFamily: fonts.bold, fontSize: 14 }}>{data.rank.checkedInToday ? '오늘 출석 완료' : '출석체크 (+100 LP)'}</Text>}</Pressable><View style={styles.summaryActions}><Pressable onPress={onOpenActivity} style={[styles.summaryAction, { backgroundColor: theme.surfaceMuted }]}><FileText color={theme.text} size={15} /><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 13 }}>내 활동</Text></Pressable><Pressable onPress={onLogout} style={[styles.summaryAction, { backgroundColor: theme.surfaceMuted }]}><LogOut color="#dc2626" size={15} /><Text style={{ color: '#dc2626', fontFamily: fonts.bold, fontSize: 13 }}>로그아웃</Text></Pressable></View></View>;
}

function AccountSkeleton() { const { theme } = useMinionTheme(); return <><View style={[styles.summary, { borderColor: theme.border }]}><View style={styles.summaryRow}><View style={[styles.skeletonCircle, { backgroundColor: theme.surfaceMuted }]} /><View style={styles.summaryCopy}><View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: '42%' }]} /><View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: '68%' }]} /><View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: '55%' }]} /></View></View><View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.checkIn, { backgroundColor: theme.surfaceMuted }]} /><View style={styles.summaryActions}><View style={[styles.summaryAction, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.summaryAction, { backgroundColor: theme.surfaceMuted }]} /></View></View>{[344, 430, 150, 280].map((height, index) => <View key={index} style={{ backgroundColor: theme.surfaceMuted, borderRadius: 12, height }} />)}</>; }

const styles = StyleSheet.create({ root: { flex: 1 }, content: { gap: 12, paddingRight: 31 }, summary: { borderRadius: 12, borderWidth: 1, padding: 16 }, summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 12 }, summaryCopy: { flex: 1, gap: 2, minWidth: 0 }, nickname: { fontSize: 18, letterSpacing: -0.45, lineHeight: 27 }, account: { fontSize: 12, lineHeight: 18 }, rankLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }, progressTrack: { borderRadius: 999, height: 6, marginTop: 12, overflow: 'hidden' }, progressBar: { borderRadius: 999, height: 6 }, checkIn: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', marginTop: 12 }, summaryActions: { flexDirection: 'row', gap: 8, marginTop: 8 }, summaryAction: { alignItems: 'center', borderRadius: 8, flex: 1, flexDirection: 'row', gap: 6, height: 40, justifyContent: 'center' }, menuGrid: { flexDirection: 'row', gap: 6 }, menuItem: { alignItems: 'center', borderRadius: 8, flex: 1, flexDirection: 'row', gap: 4, height: 40, justifyContent: 'center', minWidth: 0, paddingHorizontal: 4 }, errorCard: { alignItems: 'center', borderRadius: 12, borderWidth: 1, gap: 16, padding: 24 }, retry: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 }, skeletonCircle: { borderRadius: 28, height: 56, width: 56 }, skeletonLine: { borderRadius: 4, height: 14 } });
