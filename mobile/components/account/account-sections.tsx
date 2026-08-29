import Bell from 'lucide-react-native/icons/bell';
import Camera from 'lucide-react-native/icons/camera';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Radio from 'lucide-react-native/icons/radio';
import ShieldBan from 'lucide-react-native/icons/shield-ban';
import Swords from 'lucide-react-native/icons/swords';
import Video from 'lucide-react-native/icons/video';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MobileMeDto, MobileNotificationPreferences, MobileTeamNotificationSettings } from '../../../packages/contracts/src/mobile-v1';
import { RankAvatar } from '@/components/rank-avatar';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import {
  getPushPermissionStatus,
  openPushNotificationSettings,
  requestPushPermissionAndRegister,
  type PushPermissionSnapshot,
} from '@/lib/push-notifications';

export function AccountSection({ children, description, icon: Icon, title }: { children: React.ReactNode; description: string; icon: LucideIcon; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={styles.sectionHeading}>
      <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceMuted }]}><Icon color={theme.muted} size={16} /></View>
      <View style={styles.sectionCopy}><Text style={[styles.sectionTitle, { color: theme.ink, ...fonts.black }]}>{title}</Text><Text style={[styles.sectionDescription, { color: theme.muted, ...fonts.medium }]}>{description}</Text></View>
    </View>
    {children}
  </View>;
}

type TeamPreferenceKey = Exclude<keyof MobileTeamNotificationSettings, 'teamId' | 'teamName' | 'teamShortName'>;
const notificationOptions: { key: TeamPreferenceKey; title: string; description: string; icon: LucideIcon }[] = [
  { key: 'matchAlertsEnabled', title: '경기', description: '경기 시작과 세트 평가를 알려드려요.', icon: Swords },
  { key: 'liveMatchAlertsEnabled', title: '라이브 경기', description: '킬과 주요 오브젝트를 실시간으로 알려드려요.', icon: Radio },
  { key: 'instagramAlertsEnabled', title: 'Instagram', description: '팀과 소속 선수의 새 게시물을 알려드려요.', icon: Camera },
  { key: 'videoAlertsEnabled', title: '동영상', description: '팀과 소속 선수의 새 영상을 알려드려요.', icon: Video },
  { key: 'soloQueueAlertsEnabled', title: '솔랭', description: '소속 선수가 솔랭을 시작하면 알려드려요.', icon: Gamepad2 },
];

function teamNotificationSummary(team: MobileTeamNotificationSettings) {
  const enabled = notificationOptions.filter((option) => team[option.key]).map((option) => option.title);
  return enabled.length > 0 ? enabled.join(' · ') : '모든 알림 꺼짐';
}

export function NotificationSection({ initialPreferences, initialTeams, onSave }: {
  initialPreferences: MobileNotificationPreferences;
  initialTeams: MobileTeamNotificationSettings[];
  onSave: (preferences: MobileNotificationPreferences, teams: MobileTeamNotificationSettings[]) => Promise<void>;
}) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [teams, setTeams] = useState(initialTeams);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pushPending, setPushPending] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermissionSnapshot | null>(null);
  const toggle = (key: keyof MobileNotificationPreferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const updateTeam = (teamId: string, key: TeamPreferenceKey) => setTeams((current) => current.map((team) => team.teamId === teamId ? { ...team, [key]: !team[key] } : team));

  useEffect(() => {
    const refresh = () => { void getPushPermissionStatus().then(setPushPermission).catch(() => setPushPermission({ canAskAgain: false, status: 'unsupported' })); };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => subscription.remove();
  }, []);

  const pushDescription = pushPermission?.status === 'granted'
    ? '이 기기에서 앱 밖 알림을 받을 수 있어요. 눌러 시스템 설정에서 변경합니다.'
    : pushPermission?.status === 'denied'
      ? '시스템에서 차단되어 있어요. 눌러 기기 설정에서 허용해주세요.'
      : pushPermission?.status === 'unsupported'
        ? '설치된 개발 빌드 또는 정식 앱에서 설정할 수 있어요.'
        : pushPermission
          ? '경기 시작과 댓글을 앱 밖에서도 받아요.'
          : '이 기기의 푸시 알림 상태를 확인하고 있어요.';

  const changePushPermission = async () => {
    if (!pushPermission || pushPending || pushPermission.status === 'unsupported') return;
    setPushPending(true);
    try {
      if (pushPermission.status === 'granted' || pushPermission.status === 'denied' || !pushPermission.canAskAgain) {
        await openPushNotificationSettings();
        return;
      }
      const next = await requestPushPermissionAndRegister();
      setPushPermission(next);
      showToast(next.status === 'granted' ? '이 기기의 푸시 알림을 켰습니다.' : '푸시 알림이 허용되지 않았습니다.', next.status === 'granted' ? 'success' : 'error');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '푸시 알림을 설정하지 못했습니다.', 'error');
      void getPushPermissionStatus().then(setPushPermission);
    } finally {
      setPushPending(false);
    }
  };

  return <AccountSection description="커뮤니티와 팔로우한 팀별 알림을 선택합니다." icon={Bell} title="알림">
    <View style={[styles.devicePushCard, { borderColor: theme.border }]}>
      <NotificationRow checked={pushPermission?.status === 'granted'} description={pushDescription} disabled={!pushPermission || pushPermission.status === 'unsupported' || pushPending} emphasized icon={Bell} onPress={() => void changePushPermission()} title="푸시 알림 (이 기기)" />
    </View>
    <NotificationRow checked={preferences.inAppEnabled} description="끄면 모든 알림을 잠시 받지 않아요. 세부 설정은 유지됩니다." emphasized icon={Bell} onPress={() => toggle('inAppEnabled')} title="전체 알림" />
    <View style={{ opacity: preferences.inAppEnabled ? 1 : 0.45 }}>
      <View style={[styles.communityNotificationCard, { borderColor: theme.border }]}>
        <NotificationRow checked={preferences.communityEnabled} description="내 글의 새 댓글과 내 댓글의 새 답글을 알려드려요." icon={MessageCircle} onPress={() => toggle('communityEnabled')} title="커뮤니티 알림" />
      </View>
      <View style={styles.teamNotificationList}>
      {teams.length > 0 ? teams.map((team) => {
        const expanded = expandedTeamId === team.teamId;
        return <View key={team.teamId} style={[styles.teamNotificationCard, { borderColor: theme.border }]}>
          <Pressable accessibilityRole="button" onPress={() => setExpandedTeamId(expanded ? null : team.teamId)} style={styles.teamNotificationHeader}>
            <View style={[styles.teamInitial, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{team.teamShortName.slice(0, 2)}</Text></View>
            <View style={styles.notificationCopy}><Text numberOfLines={1} style={[styles.teamNotificationName, { color: theme.ink, ...fonts.black }]}>{team.teamName}</Text><Text numberOfLines={1} style={[styles.teamNotificationSummary, { color: theme.muted, ...fonts.medium }]}>{teamNotificationSummary(team)}</Text></View>
            <ChevronRight color={theme.muted} size={17} style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }} />
          </Pressable>
          {expanded ? <View style={{ borderTopColor: theme.border, borderTopWidth: 1, paddingHorizontal: 8 }}>
            {notificationOptions.map((option, index) => <View key={option.key} style={index ? { borderTopColor: theme.border, borderTopWidth: 1 } : null}><NotificationRow checked={team[option.key]} description={option.description} icon={option.icon} onPress={() => updateTeam(team.teamId, option.key)} title={option.title} /></View>)}
          </View> : null}
        </View>;
      }) : <View style={[styles.notificationEmpty, { borderColor: theme.border }]}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24 }}>팔로우한 팀이 없습니다.</Text></View>}
      </View>
    </View>
    <View style={[styles.notificationFooter, { borderTopColor: theme.border }]}>
      <Text style={[styles.notificationFootnote, { color: theme.muted, ...fonts.medium }]}>알림 종류는 계정의 모든 기기에 적용되고, 푸시 허용 여부는 기기별로 관리됩니다.</Text>
      <Pressable disabled={pending} onPress={() => { setPending(true); void onSave(preferences, teams).catch((error) => showToast(error instanceof Error ? error.message : '알림 설정을 저장하지 못했습니다.', 'error')).finally(() => setPending(false)); }} style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: pending ? 0.5 : 1 }]}>
        {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={[styles.primaryButtonText, { color: theme.accentForeground, ...fonts.medium }]}>변경사항 저장</Text>}
      </Pressable>
    </View>
  </AccountSection>;
}

function NotificationRow({ checked, description, disabled = false, emphasized = false, icon: Icon, onPress, title }: { checked: boolean; description: string; disabled?: boolean; emphasized?: boolean; icon: LucideIcon; onPress: () => void; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[styles.notificationRow, emphasized ? { backgroundColor: theme.surfaceMuted } : null, disabled ? { opacity: 0.55 } : null]}>
    <View style={[styles.notificationIcon, { backgroundColor: theme.surface }]}><Icon color={theme.muted} size={17} /></View>
    <View style={styles.notificationCopy}><Text style={[styles.notificationTitle, { color: theme.ink, ...fonts.medium }]}>{title}</Text><Text style={[styles.notificationDescription, { color: theme.muted, ...fonts.medium }]}>{description}</Text></View>
    <View style={[styles.switchTrack, { backgroundColor: checked ? theme.accent : theme.border }]}><View style={[styles.switchKnob, { transform: [{ translateX: checked ? 20 : 0 }] }]} /></View>
  </Pressable>;
}

export function BlockedSection({ blockedGuests, blockedUsers, onUnblockGuest, onUnblockUser }: { blockedGuests: MobileMeDto['blockedGuests']; blockedUsers: MobileMeDto['blockedUsers']; onUnblockGuest: (guestKey: string) => Promise<void>; onUnblockUser: (userId: string) => Promise<void> }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const empty = blockedUsers.length === 0 && blockedGuests.length === 0;
  const unblock = async (key: string, action: () => Promise<void>) => { setPendingKey(key); try { await action(); } catch (error) { showToast(error instanceof Error ? error.message : '차단을 해제하지 못했습니다.', 'error'); } finally { setPendingKey(null); } };
  return <AccountSection description="차단한 사용자와 해제할 사용자를 관리합니다." icon={ShieldBan} title="차단 관리">
    {empty ? <Text style={[styles.blockedEmpty, { color: theme.muted, ...fonts.regular }]}>차단한 사용자가 없습니다.</Text> : <View>
      {blockedUsers.map((user, index) => <View key={user.id} style={[styles.blockedRow, index ? { borderTopColor: theme.border, borderTopWidth: 1 } : null]}><RankAvatar fallback={user.nickname.charAt(0)} profileImageUrl={user.profileImage?.url} tier={user.tier} /><Text numberOfLines={1} style={[styles.blockedName, { color: theme.ink, ...fonts.medium }]}>{user.nickname}</Text><UnblockButton disabled={pendingKey === user.id} onPress={() => void unblock(user.id, () => onUnblockUser(user.id))} /></View>)}
      {blockedGuests.map((guest) => <View key={guest.guestKey} style={[styles.blockedRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}><View style={[styles.guestAvatar, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>G</Text></View><Text numberOfLines={1} style={[styles.blockedName, { color: theme.ink, ...fonts.medium }]}>{guest.nickname}</Text><UnblockButton disabled={pendingKey === guest.guestKey} onPress={() => void unblock(guest.guestKey, () => onUnblockGuest(guest.guestKey))} /></View>)}
    </View>}
  </AccountSection>;
}

function UnblockButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) { const { fonts, theme } = useMinionTheme(); return <Pressable disabled={disabled} onPress={onPress} style={[styles.unblock, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13 }}>차단 해제</Text></Pressable>; }

const providerLabels: Record<string, string> = { google: '구글', kakao: '카카오', 'custom:naver': '네이버', apple: 'Apple' };

export function AccountSecuritySection({ account, authProvider, email, onChangePassword, onDelete, onReauthenticate }: { account: MobileMeDto['account']; authProvider: string | null; email: string | null; onChangePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>; onDelete: (input: { confirmText: string; password?: string }) => Promise<void>; onReauthenticate: () => Promise<void> }) {
  const { fonts, theme } = useMinionTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const accountLabel = account.hasPassword ? email ?? '이메일 정보 없음' : `${(authProvider ? providerLabels[authProvider] : undefined) ?? '소셜'} 로그인`;
  return <AccountSection description="로그인 정보와 보안 설정을 확인합니다." icon={LockKeyhole} title="계정 및 보안">
    <View style={[styles.accountInfo, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.accountLabel, { color: theme.muted, ...fonts.medium }]}>로그인 계정</Text><Text style={[styles.accountValue, { color: theme.ink, ...fonts.medium }]}>{accountLabel}</Text></View>
    {account.hasPassword ? <Collapsible danger={false} onPress={() => setPasswordOpen((value) => !value)} open={passwordOpen} title="비밀번호 변경">{passwordOpen ? <PasswordForm onSubmit={onChangePassword} /> : null}</Collapsible> : null}
    <Collapsible danger onPress={() => setDeleteOpen((value) => !value)} open={deleteOpen} title="회원 탈퇴">{deleteOpen ? <DeleteAccountForm account={account} authProvider={authProvider} onCancel={() => setDeleteOpen(false)} onDelete={onDelete} onReauthenticate={onReauthenticate} /> : null}</Collapsible>
  </AccountSection>;
}

function Collapsible({ children, danger, onPress, open, title }: { children: React.ReactNode; danger: boolean; onPress: () => void; open: boolean; title: string }) { const { fonts, theme } = useMinionTheme(); const color = danger ? '#dc2626' : theme.ink; const border = danger ? '#dc262647' : theme.border; return <View style={[styles.collapsible, { borderColor: border }]}><Pressable hitSlop={4} onPress={onPress} style={styles.collapsibleHeader}><Text style={{ color, ...fonts.medium, fontSize: 13 }}>{title}</Text><ChevronRight color={color} size={16} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} /></Pressable>{open ? <View style={[styles.collapsibleBody, { borderTopColor: border }]}>{children}</View> : null}</View>; }

function PasswordForm({ onSubmit }: { onSubmit: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [pending, setPending] = useState(false); const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const submit = async () => { setPending(true); setMessage(null); try { await onSubmit({ currentPassword, newPassword, confirmPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage({ error: false, text: '비밀번호가 변경되었습니다.' }); } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.' }); } finally { setPending(false); } };
  return <View style={styles.securityForm}><SecurityField label="현재 비밀번호" onChangeText={setCurrentPassword} value={currentPassword} /><SecurityField hint="6자 이상 입력해주세요." label="새 비밀번호" onChangeText={setNewPassword} value={newPassword} /><SecurityField label="새 비밀번호 확인" onChangeText={setConfirmPassword} value={confirmPassword} />{message ? <ResultMessage {...message} /> : null}<SmallButton disabled={pending} label={pending ? '변경 중...' : '비밀번호 변경'} onPress={() => void submit()} /></View>;
}

function DeleteAccountForm({ account, authProvider, onCancel, onDelete, onReauthenticate }: { account: MobileMeDto['account']; authProvider: string | null; onCancel: () => void; onDelete: (input: { confirmText: string; password?: string }) => Promise<void>; onReauthenticate: () => Promise<void> }) {
  const { fonts, theme } = useMinionTheme(); const [password, setPassword] = useState(''); const [confirmText, setConfirmText] = useState(''); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null); const needsReauth = !account.hasPassword && !account.recentlyReauthenticated; const providerLabel = (authProvider ? providerLabels[authProvider] : undefined) ?? '소셜';
  const submit = async () => { setPending(true); setMessage(null); try { await onDelete({ confirmText, ...(account.hasPassword ? { password } : {}) }); } catch (error) { setMessage(error instanceof Error ? error.message : '회원 탈퇴에 실패했습니다.'); setPending(false); } };
  const reauthenticate = async () => { setMessage(null); try { await onReauthenticate(); } catch (error) { setMessage(error instanceof Error ? error.message : '재인증을 시작하지 못했습니다.'); } };
  return <View style={styles.securityForm}><Text style={[styles.deleteDescription, { color: theme.muted, ...fonts.regular }]}>탈퇴하면 티어·LP·출석 기록과 승부예측 내역이 모두 삭제되며 되돌릴 수 없습니다. 작성한 게시글과 댓글은 커뮤니티에 남고 작성자만 알 수 없음으로 표시됩니다. 같은 이메일로 다시 가입하더라도 이전 기록은 복구되지 않습니다.</Text>{needsReauth ? <><Text style={[styles.reauthText, { color: theme.muted, ...fonts.regular }]}>소셜 로그인 계정은 본인 확인을 위해 {providerLabel} 계정으로 방금 다시 로그인한 상태여야 탈퇴할 수 있어요.</Text>{message ? <ResultMessage error text={message} /> : null}<SmallButton label={`${providerLabel}로 재인증하기`} onPress={() => void reauthenticate()} /><SmallButton label="취소" onPress={onCancel} secondary /></> : <>{account.hasPassword ? <SecurityField label="비밀번호 확인" onChangeText={setPassword} value={password} /> : <Text style={[styles.reauthText, { color: theme.muted, ...fonts.regular }]}>{providerLabel} 계정 재인증이 확인됐습니다. 아래 확인 문구를 입력하면 탈퇴가 진행됩니다.</Text>}<SecurityField hint={<Text>계속하려면 <Text style={{ ...fonts.bold }}>탈퇴합니다</Text>를 그대로 입력해주세요.</Text>} label="확인 문구" onChangeText={setConfirmText} placeholder="탈퇴합니다" secure={false} value={confirmText} />{message ? <ResultMessage error text={message} /> : null}<View style={styles.buttonRow}><SmallButton danger disabled={pending || confirmText.trim() !== '탈퇴합니다'} label={pending ? '탈퇴 처리 중...' : '회원 탈퇴'} onPress={() => void submit()} /><SmallButton disabled={pending} label="취소" onPress={onCancel} secondary /></View></>}</View>;
}

function SecurityField({ hint, label, onChangeText, placeholder, secure = true, value }: { hint?: React.ReactNode; label: string; onChangeText: (value: string) => void; placeholder?: string; secure?: boolean; value: string }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.securityField}><Text style={[styles.label, { color: theme.ink, ...fonts.medium }]}>{label}</Text><TextInput autoCapitalize="none" onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.muted} secureTextEntry={secure} style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink, ...fonts.regular }]} value={value} />{hint ? typeof hint === 'string' ? <Text style={[styles.hint, { color: theme.muted, ...fonts.regular }]}>{hint}</Text> : <Text style={[styles.hint, { color: theme.muted, ...fonts.regular }]}>{hint}</Text> : null}</View>; }
function ResultMessage({ error, text }: { error: boolean; text: string }) { const { fonts } = useMinionTheme(); return <Text style={{ color: error ? '#dc2626' : '#16a34a', ...fonts.regular, fontSize: 13, lineHeight: 18 }}>{text}</Text>; }
function SmallButton({ danger = false, disabled = false, label, onPress, secondary = false }: { danger?: boolean; disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) { const { fonts, theme } = useMinionTheme(); return <Pressable disabled={disabled} hitSlop={4} onPress={onPress} style={[styles.smallButton, { backgroundColor: danger ? '#dc2626' : secondary ? theme.surfaceMuted : theme.accent, opacity: disabled ? 0.5 : 1 }]}><Text style={{ color: danger ? '#fff' : secondary ? theme.ink : theme.accentForeground, ...fonts.medium, fontSize: 13 }}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  section: { borderRadius: 12, borderWidth: 1, padding: 16 }, sectionHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 16 }, sectionIcon: { alignItems: 'center', borderRadius: 8, height: 30, justifyContent: 'center', width: 30 }, sectionCopy: { flex: 1, minWidth: 0 }, sectionTitle: { fontSize: 15, letterSpacing: -0.3, lineHeight: 22 }, sectionDescription: { fontSize: 13, lineHeight: 18 },
  devicePushCard: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden' }, communityNotificationCard: { borderRadius: 12, borderWidth: 1, marginTop: 12, overflow: 'hidden', paddingHorizontal: 8 }, teamNotificationList: { gap: 8, marginTop: 12 }, teamNotificationCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' }, teamNotificationHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8 }, teamInitial: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', width: 36 }, teamNotificationName: { fontSize: 15, lineHeight: 22 }, teamNotificationSummary: { fontSize: 13, lineHeight: 18 }, notificationEmpty: { alignItems: 'center', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, padding: 24 }, notificationRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, minHeight: 56, paddingHorizontal: 8, paddingVertical: 8 }, notificationIcon: { alignItems: 'center', borderRadius: 8, height: 30, justifyContent: 'center', width: 30 }, notificationCopy: { flex: 1, minWidth: 0 }, notificationTitle: { fontSize: 13, lineHeight: 18 }, notificationDescription: { fontSize: 13, lineHeight: 18, marginTop: 2 }, switchTrack: { borderRadius: 12, height: 24, padding: 2, width: 44 }, switchKnob: { backgroundColor: '#fff', borderRadius: 10, height: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.15, shadowRadius: 2, width: 20 }, notificationFooter: { borderTopWidth: 1, gap: 12, marginTop: 12, paddingTop: 12 }, notificationFootnote: { fontSize: 13, lineHeight: 18 }, primaryButton: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', width: '100%' }, primaryButtonText: { fontSize: 13, lineHeight: 18 },
  blockedEmpty: { fontSize: 13, lineHeight: 20, paddingVertical: 20, textAlign: 'center' }, blockedRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, paddingVertical: 12 }, blockedName: { flex: 1, fontSize: 14, lineHeight: 20 }, guestAvatar: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 }, unblock: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  accountInfo: { borderRadius: 12, padding: 12 }, accountLabel: { fontSize: 13, lineHeight: 18 }, accountValue: { fontSize: 13, lineHeight: 18, marginTop: 3 }, collapsible: { borderRadius: 12, borderWidth: 1, marginTop: 10, overflow: 'hidden' }, collapsibleHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 }, collapsibleBody: { borderTopWidth: 1, padding: 16 }, securityForm: { gap: 12 }, securityField: { gap: 4 }, label: { fontSize: 13, lineHeight: 18 }, input: { borderRadius: 8, borderWidth: 1, fontSize: 13, height: 36, lineHeight: 18, paddingHorizontal: 10, paddingVertical: 0 }, hint: { fontSize: 13, lineHeight: 18 }, smallButton: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, height: 36, justifyContent: 'center', paddingHorizontal: 16 }, deleteDescription: { fontSize: 13, lineHeight: 22 }, reauthText: { fontSize: 13, lineHeight: 18 }, buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
