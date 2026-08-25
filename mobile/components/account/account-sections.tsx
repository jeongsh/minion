import Bell from 'lucide-react-native/icons/bell';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import Radio from 'lucide-react-native/icons/radio';
import ShieldBan from 'lucide-react-native/icons/shield-ban';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Swords from 'lucide-react-native/icons/swords';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MobileMeDto, MobileNotificationPreferences } from '../../../packages/contracts/src/mobile-v1';
import { RankAvatar } from '@/components/rank-avatar';
import { useMinionTheme } from '@/hooks/use-minion-theme';

export function AccountSection({ children, description, icon: Icon, title }: { children: React.ReactNode; description: string; icon: LucideIcon; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={styles.sectionHeading}>
      <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceMuted }]}><Icon color={theme.muted} size={18} /></View>
      <View style={styles.sectionCopy}><Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: fonts.black }]}>{title}</Text><Text style={[styles.sectionDescription, { color: theme.muted, fontFamily: fonts.medium }]}>{description}</Text></View>
    </View>
    {children}
  </View>;
}

const notificationOptions: { key: Exclude<keyof MobileNotificationPreferences, 'inAppEnabled'>; title: string; description: string; icon: LucideIcon }[] = [
  { key: 'matchStartEnabled', title: '경기 시작', description: '팔로우한 팀의 경기가 시작되면 알려드려요.', icon: Swords },
  { key: 'matchEventsEnabled', title: '경기 주요 이벤트', description: '킬과 주요 오브젝트 등 실시간 경기 소식을 받아요.', icon: Radio },
  { key: 'ratingOpenEnabled', title: '세트 평가 오픈', description: '경기 세트 평가가 열리면 알려드려요.', icon: Sparkles },
];

export function NotificationSection({ initialPreferences, onSave }: { initialPreferences: MobileNotificationPreferences; onSave: (preferences: MobileNotificationPreferences) => Promise<void> }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pending, setPending] = useState(false);
  const toggle = (key: keyof MobileNotificationPreferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  return <AccountSection description="필요한 경기 소식만 골라서 받아보세요." icon={Bell} title="알림">
    <NotificationRow checked={preferences.inAppEnabled} description="MINION을 이용하는 동안 알림함과 토스트로 소식을 받아요." emphasized icon={Bell} onPress={() => toggle('inAppEnabled')} title="인앱 알림" />
    <View style={[styles.notificationList, { opacity: preferences.inAppEnabled ? 1 : 0.45 }]} pointerEvents={preferences.inAppEnabled ? 'auto' : 'none'}>
      {notificationOptions.map((option, index) => <View key={option.key} style={index ? { borderTopColor: theme.border, borderTopWidth: 1 } : null}><NotificationRow checked={preferences[option.key]} description={option.description} icon={option.icon} onPress={() => toggle(option.key)} title={option.title} /></View>)}
    </View>
    <View style={[styles.notificationFooter, { borderTopColor: theme.border }]}>
      <Text style={[styles.notificationFootnote, { color: theme.muted, fontFamily: fonts.medium }]}>설정은 로그인한 모든 기기에 적용됩니다.</Text>
      <Pressable disabled={pending} onPress={() => { setPending(true); void onSave(preferences).catch((error) => showToast(error instanceof Error ? error.message : '알림 설정을 저장하지 못했습니다.', 'error')).finally(() => setPending(false)); }} style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: pending ? 0.5 : 1 }]}>
        {pending ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={[styles.primaryButtonText, { color: theme.accentForeground, fontFamily: fonts.bold }]}>변경사항 저장</Text>}
      </Pressable>
    </View>
  </AccountSection>;
}

function NotificationRow({ checked, description, emphasized = false, icon: Icon, onPress, title }: { checked: boolean; description: string; emphasized?: boolean; icon: LucideIcon; onPress: () => void; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={[styles.notificationRow, emphasized ? { backgroundColor: theme.surfaceMuted } : null]}>
    <View style={[styles.notificationIcon, { backgroundColor: theme.surface }]}><Icon color={theme.muted} size={17} /></View>
    <View style={styles.notificationCopy}><Text style={[styles.notificationTitle, { color: theme.ink, fontFamily: fonts.bold }]}>{title}</Text><Text style={[styles.notificationDescription, { color: theme.muted, fontFamily: fonts.medium }]}>{description}</Text></View>
    <View style={[styles.switchTrack, { backgroundColor: checked ? theme.accent : theme.border }]}><View style={[styles.switchKnob, { transform: [{ translateX: checked ? 20 : 0 }] }]} /></View>
  </Pressable>;
}

export function BlockedSection({ blockedGuests, blockedUsers, onUnblockGuest, onUnblockUser }: { blockedGuests: MobileMeDto['blockedGuests']; blockedUsers: MobileMeDto['blockedUsers']; onUnblockGuest: (guestKey: string) => Promise<void>; onUnblockUser: (userId: string) => Promise<void> }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const empty = blockedUsers.length === 0 && blockedGuests.length === 0;
  const unblock = async (key: string, action: () => Promise<void>) => { setPendingKey(key); try { await action(); } catch (error) { showToast(error instanceof Error ? error.message : '차단을 해제하지 못했습니다.', 'error'); } finally { setPendingKey(null); } };
  return <AccountSection description="차단한 사용자와 해제할 사용자를 관리합니다." icon={ShieldBan} title="차단 관리">
    {empty ? <Text style={[styles.blockedEmpty, { color: theme.muted, fontFamily: fonts.regular }]}>차단한 사용자가 없습니다.</Text> : <View>
      {blockedUsers.map((user, index) => <View key={user.id} style={[styles.blockedRow, index ? { borderTopColor: theme.border, borderTopWidth: 1 } : null]}><RankAvatar fallback={user.nickname.charAt(0)} profileImageUrl={user.profileImage?.url} tier={user.tier} /><Text numberOfLines={1} style={[styles.blockedName, { color: theme.ink, fontFamily: fonts.bold }]}>{user.nickname}</Text><UnblockButton disabled={pendingKey === user.id} onPress={() => void unblock(user.id, () => onUnblockUser(user.id))} /></View>)}
      {blockedGuests.map((guest) => <View key={guest.guestKey} style={[styles.blockedRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}><View style={[styles.guestAvatar, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>G</Text></View><Text numberOfLines={1} style={[styles.blockedName, { color: theme.ink, fontFamily: fonts.bold }]}>{guest.nickname}</Text><UnblockButton disabled={pendingKey === guest.guestKey} onPress={() => void unblock(guest.guestKey, () => onUnblockGuest(guest.guestKey))} /></View>)}
    </View>}
  </AccountSection>;
}

function UnblockButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) { const { fonts, theme } = useMinionTheme(); return <Pressable disabled={disabled} onPress={onPress} style={[styles.unblock, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>차단 해제</Text></Pressable>; }

const providerLabels: Record<string, string> = { google: '구글', kakao: '카카오', 'custom:naver': '네이버', apple: 'Apple' };

export function AccountSecuritySection({ account, authProvider, email, onChangePassword, onDelete, onReauthenticate }: { account: MobileMeDto['account']; authProvider: string | null; email: string | null; onChangePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>; onDelete: (input: { confirmText: string; password?: string }) => Promise<void>; onReauthenticate: () => Promise<void> }) {
  const { fonts, theme } = useMinionTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const accountLabel = account.hasPassword ? email ?? '이메일 정보 없음' : `${(authProvider ? providerLabels[authProvider] : undefined) ?? '소셜'} 로그인`;
  return <AccountSection description="로그인 정보와 보안 설정을 확인합니다." icon={LockKeyhole} title="계정 및 보안">
    <View style={[styles.accountInfo, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.accountLabel, { color: theme.muted, fontFamily: fonts.bold }]}>로그인 계정</Text><Text style={[styles.accountValue, { color: theme.ink, fontFamily: fonts.bold }]}>{accountLabel}</Text></View>
    {account.hasPassword ? <Collapsible danger={false} onPress={() => setPasswordOpen((value) => !value)} open={passwordOpen} title="비밀번호 변경">{passwordOpen ? <PasswordForm onSubmit={onChangePassword} /> : null}</Collapsible> : null}
    <Collapsible danger onPress={() => setDeleteOpen((value) => !value)} open={deleteOpen} title="회원 탈퇴">{deleteOpen ? <DeleteAccountForm account={account} authProvider={authProvider} onCancel={() => setDeleteOpen(false)} onDelete={onDelete} onReauthenticate={onReauthenticate} /> : null}</Collapsible>
  </AccountSection>;
}

function Collapsible({ children, danger, onPress, open, title }: { children: React.ReactNode; danger: boolean; onPress: () => void; open: boolean; title: string }) { const { fonts, theme } = useMinionTheme(); const color = danger ? '#dc2626' : theme.ink; const border = danger ? '#dc262647' : theme.border; return <View style={[styles.collapsible, { borderColor: border }]}><Pressable onPress={onPress} style={styles.collapsibleHeader}><Text style={{ color, fontFamily: fonts.bold, fontSize: 14 }}>{title}</Text><ChevronRight color={color} size={17} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} /></Pressable>{open ? <View style={[styles.collapsibleBody, { borderTopColor: border }]}>{children}</View> : null}</View>; }

function PasswordForm({ onSubmit }: { onSubmit: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [pending, setPending] = useState(false); const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const submit = async () => { setPending(true); setMessage(null); try { await onSubmit({ currentPassword, newPassword, confirmPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage({ error: false, text: '비밀번호가 변경되었습니다.' }); } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.' }); } finally { setPending(false); } };
  return <View style={styles.securityForm}><SecurityField label="현재 비밀번호" onChangeText={setCurrentPassword} value={currentPassword} /><SecurityField hint="6자 이상 입력해주세요." label="새 비밀번호" onChangeText={setNewPassword} value={newPassword} /><SecurityField label="새 비밀번호 확인" onChangeText={setConfirmPassword} value={confirmPassword} />{message ? <ResultMessage {...message} /> : null}<SmallButton disabled={pending} label={pending ? '변경 중...' : '비밀번호 변경'} onPress={() => void submit()} /></View>;
}

function DeleteAccountForm({ account, authProvider, onCancel, onDelete, onReauthenticate }: { account: MobileMeDto['account']; authProvider: string | null; onCancel: () => void; onDelete: (input: { confirmText: string; password?: string }) => Promise<void>; onReauthenticate: () => Promise<void> }) {
  const { fonts, theme } = useMinionTheme(); const [password, setPassword] = useState(''); const [confirmText, setConfirmText] = useState(''); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null); const needsReauth = !account.hasPassword && !account.recentlyReauthenticated; const providerLabel = (authProvider ? providerLabels[authProvider] : undefined) ?? '소셜';
  const submit = async () => { setPending(true); setMessage(null); try { await onDelete({ confirmText, ...(account.hasPassword ? { password } : {}) }); } catch (error) { setMessage(error instanceof Error ? error.message : '회원 탈퇴에 실패했습니다.'); setPending(false); } };
  const reauthenticate = async () => { setMessage(null); try { await onReauthenticate(); } catch (error) { setMessage(error instanceof Error ? error.message : '재인증을 시작하지 못했습니다.'); } };
  return <View style={styles.securityForm}><Text style={[styles.deleteDescription, { color: theme.muted, fontFamily: fonts.regular }]}>탈퇴하면 티어·LP·출석 기록과 승부예측 내역이 모두 삭제되며 되돌릴 수 없습니다. 작성한 게시글과 댓글은 커뮤니티에 남고 작성자만 알 수 없음으로 표시됩니다. 같은 이메일로 다시 가입하더라도 이전 기록은 복구되지 않습니다.</Text>{needsReauth ? <><Text style={[styles.reauthText, { color: theme.muted, fontFamily: fonts.regular }]}>소셜 로그인 계정은 본인 확인을 위해 {providerLabel} 계정으로 방금 다시 로그인한 상태여야 탈퇴할 수 있어요.</Text>{message ? <ResultMessage error text={message} /> : null}<SmallButton label={`${providerLabel}로 재인증하기`} onPress={() => void reauthenticate()} /><SmallButton label="취소" onPress={onCancel} secondary /></> : <>{account.hasPassword ? <SecurityField label="비밀번호 확인" onChangeText={setPassword} value={password} /> : <Text style={[styles.reauthText, { color: theme.muted, fontFamily: fonts.regular }]}>{providerLabel} 계정 재인증이 확인됐습니다. 아래 확인 문구를 입력하면 탈퇴가 진행됩니다.</Text>}<SecurityField hint={<Text>계속하려면 <Text style={{ fontFamily: fonts.bold }}>탈퇴합니다</Text>를 그대로 입력해주세요.</Text>} label="확인 문구" onChangeText={setConfirmText} placeholder="탈퇴합니다" secure={false} value={confirmText} />{message ? <ResultMessage error text={message} /> : null}<View style={styles.buttonRow}><SmallButton danger disabled={pending || confirmText.trim() !== '탈퇴합니다'} label={pending ? '탈퇴 처리 중...' : '회원 탈퇴'} onPress={() => void submit()} /><SmallButton disabled={pending} label="취소" onPress={onCancel} secondary /></View></>}</View>;
}

function SecurityField({ hint, label, onChangeText, placeholder, secure = true, value }: { hint?: React.ReactNode; label: string; onChangeText: (value: string) => void; placeholder?: string; secure?: boolean; value: string }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.securityField}><Text style={[styles.label, { color: theme.ink, fontFamily: fonts.bold }]}>{label}</Text><TextInput autoCapitalize="none" onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.muted} secureTextEntry={secure} style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink, fontFamily: fonts.regular }]} value={value} />{hint ? typeof hint === 'string' ? <Text style={[styles.hint, { color: theme.muted, fontFamily: fonts.regular }]}>{hint}</Text> : <Text style={[styles.hint, { color: theme.muted, fontFamily: fonts.regular }]}>{hint}</Text> : null}</View>; }
function ResultMessage({ error, text }: { error: boolean; text: string }) { const { fonts } = useMinionTheme(); return <Text style={{ color: error ? '#dc2626' : '#16a34a', fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>{text}</Text>; }
function SmallButton({ danger = false, disabled = false, label, onPress, secondary = false }: { danger?: boolean; disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) { const { fonts, theme } = useMinionTheme(); return <Pressable disabled={disabled} onPress={onPress} style={[styles.smallButton, { backgroundColor: danger ? '#dc2626' : secondary ? theme.surfaceMuted : theme.accent, opacity: disabled ? 0.5 : 1 }]}><Text style={{ color: danger ? '#fff' : secondary ? theme.ink : theme.accentForeground, fontFamily: fonts.bold, fontSize: 14 }}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  section: { borderRadius: 12, borderWidth: 1, padding: 16 }, sectionHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, marginBottom: 16 }, sectionIcon: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', width: 36 }, sectionCopy: { flex: 1, minWidth: 0 }, sectionTitle: { fontSize: 16, letterSpacing: -0.32, lineHeight: 24 }, sectionDescription: { fontSize: 12, lineHeight: 18 },
  notificationList: { marginTop: 8 }, notificationRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, minHeight: 64, paddingHorizontal: 8, paddingVertical: 10 }, notificationIcon: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', width: 32 }, notificationCopy: { flex: 1, minWidth: 0 }, notificationTitle: { fontSize: 13, lineHeight: 19.5 }, notificationDescription: { fontSize: 12, lineHeight: 18, marginTop: 2 }, switchTrack: { borderRadius: 12, height: 24, padding: 2, width: 44 }, switchKnob: { backgroundColor: '#fff', borderRadius: 10, height: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.15, shadowRadius: 2, width: 20 }, notificationFooter: { borderTopWidth: 1, gap: 12, marginTop: 16, paddingTop: 16 }, notificationFootnote: { fontSize: 12, lineHeight: 18 }, primaryButton: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', width: '100%' }, primaryButtonText: { fontSize: 14, lineHeight: 20 },
  blockedEmpty: { fontSize: 13, lineHeight: 20, paddingVertical: 20, textAlign: 'center' }, blockedRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, paddingVertical: 12 }, blockedName: { flex: 1, fontSize: 14, lineHeight: 20 }, guestAvatar: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 }, unblock: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  accountInfo: { borderRadius: 12, padding: 16 }, accountLabel: { fontSize: 13, lineHeight: 19.5 }, accountValue: { fontSize: 14, lineHeight: 20, marginTop: 4 }, collapsible: { borderRadius: 12, borderWidth: 1, marginTop: 12, overflow: 'hidden' }, collapsibleHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 16 }, collapsibleBody: { borderTopWidth: 1, padding: 16 }, securityForm: { gap: 16 }, securityField: { gap: 6 }, label: { fontSize: 14, lineHeight: 20 }, input: { borderRadius: 8, borderWidth: 1, fontSize: 14, height: 44, lineHeight: 20, paddingHorizontal: 12, paddingVertical: 0 }, hint: { fontSize: 13, lineHeight: 20 }, smallButton: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, height: 44, justifyContent: 'center', paddingHorizontal: 20 }, deleteDescription: { fontSize: 13, lineHeight: 24 }, reauthText: { fontSize: 14, lineHeight: 20 }, buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
