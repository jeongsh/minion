import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import CheckCheck from 'lucide-react-native/icons/check-check';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Radio from 'lucide-react-native/icons/radio';
import Star from 'lucide-react-native/icons/star';
import Trash2 from 'lucide-react-native/icons/trash-2';
import UserRound from 'lucide-react-native/icons/user-round';
import Video from 'lucide-react-native/icons/video';
import X from 'lucide-react-native/icons/x';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';
import { type InAppNotification, type InAppNotificationKind, useInAppNotifications } from '@/providers/in-app-notifications-provider';

function iconFor(kind: InAppNotificationKind): LucideIcon {
  if (kind === 'match_live' || kind === 'match_event') return Radio;
  if (kind === 'rating_open') return Star;
  if (kind === 'team_video') return Video;
  if (kind === 'player_live') return UserRound;
  if (kind === 'post_activity') return MessageCircle;
  return Bell;
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'numeric' }).format(new Date(value));
}

function NotificationRow({ notification, onClose }: { notification: InAppNotification; onClose: () => void }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const { markNotificationRead, removeNotification } = useInAppNotifications();
  const Icon = iconFor(notification.kind);
  const imageUrl = resolveApiAssetUrl(notification.imageUrl ?? notification.matchEvent?.rightImageSrc ?? notification.matchEvent?.leftImageSrc);
  const eventKind = notification.matchEvent?.kind ?? notification.matchEventKind;
  const unread = !notification.readAt;

  const open = () => {
    markNotificationRead(notification.id);
    if (notification.href) {
      onClose();
      router.push(notification.href as never);
    }
  };

  return (
    <View style={[styles.row, { backgroundColor: unread ? theme.surface : 'transparent', borderColor: unread ? theme.border : 'transparent' }]}>
      <Pressable accessibilityLabel={`${notification.title} 알림${unread ? ', 읽지 않음' : ''}`} onPress={open} style={styles.rowMain}>
        <View style={[styles.iconBox, { backgroundColor: theme.card, overflow: 'hidden' }]}>
          {imageUrl ? (
            <Image contentFit={eventKind === 'kill' ? 'cover' : 'contain'} source={{ uri: imageUrl }} style={eventKind === 'kill' ? styles.imageFill : styles.imageContain} />
          ) : <Icon color={theme.muted} size={17} />}
          {unread ? <View accessibilityElementsHidden style={[styles.unreadDot, { backgroundColor: theme.accent }]} /> : null}
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={{ color: unread ? theme.ink : theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{notification.title}</Text>
          <View style={styles.metaRow}>
            {notification.description ? <Text numberOfLines={1} style={[styles.description, { color: theme.muted, ...fonts.regular }]}>{notification.description}</Text> : null}
            <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{relativeTime(notification.createdAt)}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityLabel={`${notification.title} 알림 삭제`} hitSlop={4} onPress={() => removeNotification(notification.id)} style={styles.removeButton}>
        <X color={theme.muted} size={15} />
      </Pressable>
    </View>
  );
}

export function NotificationPanel({ onClose, open }: { onClose: () => void; open: boolean }) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { clearNotifications, markAllNotificationsRead, notifications, unreadCount } = useInAppNotifications();
  const actions = (
    <>
      {unreadCount > 0 ? (
        <Pressable accessibilityLabel={`읽지 않은 알림 ${unreadCount}개 모두 읽음 처리`} onPress={markAllNotificationsRead} style={styles.actionButton}>
          <CheckCheck color={theme.muted} size={15} />
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>모두 읽음</Text>
        </Pressable>
      ) : null}
      {notifications.length > 0 ? (
        <Pressable accessibilityLabel="알림 모두 비우기" onPress={clearNotifications} style={styles.actionButton}>
          <Trash2 color={theme.muted} size={15} />
          <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>비우기</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <BottomSheet
      actions={actions}
      backdropColor={colorScheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)'}
      contentStyle={styles.content}
      headingStyle={styles.heading}
      onClose={onClose}
      open={open}
      panelStyle={{ backgroundColor: theme.pageBackground }}
      scrollable={notifications.length > 0}
      title="알림">
      {notifications.length > 0 ? (
        <View style={styles.list}>
          {notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} onClose={onClose} />)}
        </View>
      ) : (
        <View style={styles.empty}>
          <Bell color={theme.muted} size={23} />
          <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22 }}>새 알림이 없습니다</Text>
          <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 18 }}>새 소식이 도착하면 여기에 표시됩니다.</Text>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actionButton: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 36, paddingHorizontal: 7 },
  content: { paddingHorizontal: 10, paddingTop: 4 },
  copy: { flex: 1, minWidth: 0, paddingVertical: 4 },
  description: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', minHeight: 180, paddingHorizontal: 12, paddingTop: 44 },
  heading: { paddingHorizontal: 12 },
  iconBox: { alignItems: 'center', borderRadius: 6, height: 28, justifyContent: 'center', position: 'relative', width: 28 },
  imageContain: { height: 20, width: 20 },
  imageFill: { height: 28, width: 28 },
  list: { gap: 4, paddingBottom: 4 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 0 },
  removeButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  row: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 48, paddingHorizontal: 8, paddingVertical: 4 },
  rowMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  unreadDot: { borderRadius: 3, height: 6, position: 'absolute', right: 2, top: 2, width: 6 },
});
