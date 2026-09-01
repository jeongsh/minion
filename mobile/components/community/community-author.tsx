import { usePathname, useRouter } from 'expo-router';
import Ban from 'lucide-react-native/icons/ban';
import FileText from 'lucide-react-native/icons/file-text';
import Flag from 'lucide-react-native/icons/flag';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import UserRound from 'lucide-react-native/icons/user-round';
import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { RankAvatar } from '@/components/rank-avatar';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileCommunityActionDto, MobileCommunityAuthor } from '@/lib/api-client';
import { mutateMobileApi } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { displayAuthor } from './community-utils';

type Evidence = { target: 'post' | 'comment'; targetId: string };

export function CommunityAuthor({ author, detailMeta, evidence, hideAvatar = false, onBlocked, variant = 'comment' }: {
  author: MobileCommunityAuthor;
  detailMeta?: React.ReactNode;
  evidence?: Evidence;
  onBlocked?: () => void;
  variant?: 'detail' | 'comment' | 'profile';
  hideAvatar?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { session, viewer } = useAuth();
  const { fonts, theme } = useMinionTheme();
  const triggerRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 14, top: 80 });
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const name = displayAuthor(author);
  const favoriteTeam = author.favoriteTeam;
  const guest = !author.id;
  const self = Boolean(author.id && author.id === viewer?.id);
  const navigationRows = guest ? 0 : variant === 'profile' ? 2 : 3;
  const rowCount = navigationRows + (self ? 0 : 2);
  const menuHeight = rowCount * 40 + 14 + (!guest && !self ? 9 : 0);

  const requireLogin = () => {
    if (session) return true;
    router.push(`/login?next=${encodeURIComponent(pathname)}` as never);
    return false;
  };
  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        left: Math.max(8, Math.min(x, windowWidth - 216)),
        top: Math.max(8, Math.min(y + height + 8, windowHeight - menuHeight - 12)),
      });
      setMenuOpen(true);
    });
  };
  const navigate = (tab?: 'posts' | 'comments') => {
    setMenuOpen(false);
    if (!author.id) return;
    router.push(`/community/user/${author.id}${tab ? `?tab=${tab}` : ''}` as never);
  };
  const block = () => {
    setMenuOpen(false);
    if (!requireLogin() || (!author.id && !evidence)) return;
    Alert.alert('사용자 차단', `${name} 작성자의 글과 댓글을 내 화면에서 숨길까요?`, [
      { style: 'cancel', text: '취소' },
      {
        style: 'destructive',
        text: '차단',
        onPress: () => {
          setPending(true);
          void mutateMobileApi<MobileCommunityActionDto>('/api/mobile/v1/community/authors/actions', 'POST', {
            action: 'block',
            target: evidence?.target,
            targetId: evidence?.targetId,
            targetUserId: author.id,
          }).then((result) => {
            Alert.alert('사용자 차단 완료', result.message);
            onBlocked?.();
          }).catch((caught) => Alert.alert('차단 실패', caught instanceof Error ? caught.message : '사용자를 차단하지 못했습니다.')).finally(() => setPending(false));
        },
      },
    ]);
  };
  const startReport = () => {
    setMenuOpen(false);
    if (!requireLogin() || (!author.id && !evidence)) return;
    setReason('');
    setReportOpen(true);
  };
  const submitReport = async () => {
    const value = reason.trim();
    if (!value || (!author.id && !evidence) || pending) return;
    setPending(true);
    try {
      const result = guest
        ? await mutateMobileApi<MobileCommunityActionDto>('/api/mobile/v1/community/reports', 'POST', { ...evidence!, reason: value })
        : await mutateMobileApi<MobileCommunityActionDto>('/api/mobile/v1/community/authors/actions', 'POST', { action: 'report', ...evidence, reason: value, targetUserId: author.id });
      setReportOpen(false);
      Alert.alert('사용자 신고 접수', result.message);
    } catch (caught) {
      Alert.alert('신고 실패', caught instanceof Error ? caught.message : '신고를 접수하지 못했습니다.');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={[styles.root, variant === 'comment' ? styles.commentRoot : null]}>
      <Pressable
        accessibilityLabel={`${guest ? '비회원' : `${author.tier ?? '브론즈'} 티어 프로필`} ${name}${favoriteTeam ? `, ${favoriteTeam.name} 팬` : ''}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen }}
        disabled={pending}
        onPress={openMenu}
        ref={triggerRef}
        style={[styles.trigger, variant === 'comment' ? styles.commentTrigger : null, variant === 'detail' ? styles.detailTrigger : null, menuOpen ? { borderColor: theme.accent, borderWidth: 2, margin: -2 } : null]}
      >
        {hideAvatar ? null : guest ? <GuestAvatar size={variant === 'detail' ? 'detail' : 'comment'} /> : <RankAvatar fallback={name} profileImageUrl={author.profileImage?.url} size={variant === 'profile' ? 'large' : variant === 'detail' ? 'detail' : 'comment'} tier={author.tier} />}
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            {favoriteTeam ? <TeamBadge primaryColor={favoriteTeam.primaryColor} shortName={favoriteTeam.shortName} teamName={favoriteTeam.name} /> : null}
            <Text numberOfLines={1} style={[styles.name, { color: theme.ink, ...(variant === 'profile' ? fonts.bold : fonts.medium), fontSize: variant === 'profile' ? 16 : 13, lineHeight: variant === 'profile' ? 20 : 18 }]}>{name}</Text>
          </View>
          {detailMeta ? <View style={styles.detailMeta}>{detailMeta}</View> : null}
        </View>
      </Pressable>

      <Modal animationType="none" onRequestClose={() => setMenuOpen(false)} transparent visible={menuOpen}>
        <View style={StyleSheet.absoluteFill}>
          <Pressable accessibilityLabel="작성자 메뉴 닫기" onPress={() => setMenuOpen(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityRole="menu" style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border, left: menuPosition.left, top: menuPosition.top }]}>
            {!guest && variant !== 'profile' ? <MenuItem icon={<UserRound color={theme.text} size={16} />} label="프로필 보기" onPress={() => navigate()} /> : null}
            {!guest ? <MenuItem icon={<FileText color={theme.text} size={16} />} label="작성글 보기" onPress={() => navigate('posts')} /> : null}
            {!guest ? <MenuItem icon={<MessageSquareText color={theme.text} size={16} />} label="작성 댓글 보기" onPress={() => navigate('comments')} /> : null}
            {!self ? <>{!guest ? <View style={[styles.menuDivider, { backgroundColor: theme.border }]} /> : null}<MenuItem icon={<Ban color={theme.text} size={16} />} label={guest ? '이 비회원 차단' : '이 사용자 차단'} onPress={block} /><MenuItem danger icon={<Flag color="#dc2626" size={16} />} label="신고하기" onPress={startReport} /></> : null}
          </View>
        </View>
      </Modal>

      <BottomSheet onClose={() => setReportOpen(false)} open={reportOpen} scrollable title="사용자 신고">
        <Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24 }}>신고 사유를 입력해주세요. 운영자가 관련 활동과 함께 확인합니다.</Text>
        <TextInput maxLength={1000} multiline onChangeText={setReason} placeholder="신고 사유" placeholderTextColor={theme.muted} style={[styles.reasonInput, { borderColor: theme.border, color: theme.text, ...fonts.regular }]} textAlignVertical="top" value={reason} />
        <Pressable disabled={!reason.trim() || pending} onPress={() => void submitReport()} style={[styles.reportSubmit, { backgroundColor: reason.trim() && !pending ? '#dc2626' : theme.border }]}><Text style={{ color: '#fff', ...fonts.medium, fontSize: 14 }}>{pending ? '접수 중' : '신고하기'}</Text></Pressable>
      </BottomSheet>
    </View>
  );
}

function TeamBadge({ primaryColor, shortName, teamName }: { primaryColor: string; shortName: string; teamName: string }) {
  const { fonts } = useMinionTheme();
  return <View accessibilityLabel={`${teamName} 팬`} style={[styles.teamBadge, { backgroundColor: primaryColor }]}><Text numberOfLines={1} style={{ color: contrastAnchor(primaryColor), ...fonts.medium, fontSize: 12, lineHeight: 16 }}>{shortName}</Text></View>;
}

function contrastAnchor(hex: string) {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? '#111318' : '#ffffff';
}

export function GuestAvatar({ size }: { size: 'reply' | 'detail' | 'comment' }) {
  const { theme } = useMinionTheme();
  const dimension = size === 'detail' ? 36 : size === 'reply' ? 24 : 32;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: dimension / 2, height: dimension, justifyContent: 'center', width: dimension }}><UserRound color={theme.muted} size={size === 'detail' ? 21 : size === 'reply' ? 14 : 18} strokeWidth={1.7} /></View>;
}

function MenuItem({ danger = false, icon, label, onPress }: { danger?: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={styles.menuItem}>{icon}<Text style={{ color: danger ? '#dc2626' : theme.text, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { alignSelf: 'flex-start', minWidth: 0 },
  commentRoot: { width: '100%' },
  trigger: { alignItems: 'center', alignSelf: 'flex-start', borderColor: 'transparent', borderRadius: 8, flexDirection: 'row', gap: 10, maxWidth: '100%', minWidth: 0 },
  commentTrigger: { width: '100%' },
  detailTrigger: { gap: 12 },
  nameBlock: { flexShrink: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 0 },
  name: { flexShrink: 1, minWidth: 0 },
  teamBadge: { borderRadius: 999, flexShrink: 0, justifyContent: 'center', minHeight: 20, paddingHorizontal: 6, paddingVertical: 2 },
  detailMeta: { marginTop: 0 },
  menu: { borderRadius: 12, borderWidth: 1, elevation: 12, padding: 6, position: 'absolute', shadowColor: '#000', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.14, shadowRadius: 18, width: 208 },
  menuItem: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 10, height: 40, paddingHorizontal: 12 },
  menuDivider: { height: 1, marginVertical: 4 },
  reasonInput: { borderRadius: 10, borderWidth: 1, fontSize: 16, lineHeight: 24, marginTop: 14, minHeight: 112, padding: 12 },
  reportSubmit: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', marginBottom: 4, marginTop: 12 },
});
