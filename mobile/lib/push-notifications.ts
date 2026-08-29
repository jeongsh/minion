import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { mutateMobileApi } from '@/lib/api-client';

export type ForegroundPushNotification = {
  body: string | null;
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  title: string | null;
};

export type PushNotificationResponse = {
  data: Record<string, unknown>;
  id: string;
};

export type PushPermissionStatus = 'denied' | 'granted' | 'undetermined' | 'unsupported';

export type PushPermissionSnapshot = {
  canAskAgain: boolean;
  status: PushPermissionStatus;
};

type NotificationsModule = typeof import('expo-notifications');
type NotificationPermission = Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>;

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;

function supportsRemotePushNotifications() {
  return Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function permissionGranted(Notifications: NotificationsModule, permission: NotificationPermission) {
  const iosStatus = permission.ios?.status;
  return permission.granted
    || iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
    || iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
    || iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

function permissionSnapshot(Notifications: NotificationsModule, permission: NotificationPermission): PushPermissionSnapshot {
  if (permissionGranted(Notifications, permission)) return { canAskAgain: permission.canAskAgain, status: 'granted' };
  const denied = permission.status === 'denied' || permission.ios?.status === Notifications.IosAuthorizationStatus.DENIED;
  return { canAskAgain: permission.canAskAgain, status: denied ? 'denied' : 'undetermined' };
}

async function prepareAndroidChannels(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('match', {
      description: '응원하는 팀의 경기 시작과 세트 평가 알림',
      importance: Notifications.AndroidImportance.HIGH,
      name: '경기 알림',
      showBadge: false,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('community', {
      description: '내 글의 댓글과 내 댓글의 답글 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      name: '커뮤니티 알림',
      showBadge: false,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('live', {
      description: '킬과 주요 오브젝트 등 실시간 경기 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      name: '라이브 경기 알림',
      showBadge: false,
      sound: null,
    }),
    Notifications.setNotificationChannelAsync('content', {
      description: '팀과 선수의 새 소셜 게시물과 영상 알림',
      importance: Notifications.AndroidImportance.LOW,
      name: '팀 콘텐츠 알림',
      showBadge: false,
      sound: null,
    }),
  ]);
}

// 앱이 켜져있을 때(포그라운드) 도착한 푸시는 시스템 배너 대신 앱 안에서 토스트로만
// 보여준다 — 이미 보고 있는 화면 위에 OS 알림 배너까지 뜨면 과하기 때문. 백그라운드/
// 종료 상태일 땐 이 핸들러가 아예 호출되지 않아 시스템 알림이 평소처럼 뜬다.
async function loadNotifications() {
  if (!supportsRemotePushNotifications()) return null;
  notificationsModulePromise ??= import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return Notifications;
  });
  return notificationsModulePromise;
}

/** 포그라운드 푸시를 인앱 알림 저장소에 전달한다. 앱 셸에서 한 번만 구독한다. */
export function subscribeToForegroundPushNotifications(listener: (notification: ForegroundPushNotification) => void) {
  let active = true;
  let subscription: { remove: () => void } | null = null;

  void loadNotifications().then((Notifications) => {
    if (!active || !Notifications) return;
    subscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      listener({
        body: body ?? null,
        createdAt: new Date(notification.date).toISOString(),
        data: notification.request.content.data,
        id: notification.request.identifier,
        title: title ?? null,
      });
    });
  });

  return () => {
    active = false;
    subscription?.remove();
  };
}

/** 알림을 눌러 앱을 열거나 백그라운드 앱으로 돌아왔을 때 payload의 화면 경로를 전달한다. */
export function subscribeToPushNotificationResponses(listener: (response: PushNotificationResponse) => void) {
  let active = true;
  let subscription: { remove: () => void } | null = null;

  void loadNotifications().then((Notifications) => {
    if (!active || !Notifications) return;
    const emit = (response: { notification: { request: { content: { data: Record<string, unknown> }; identifier: string } } }) => {
      listener({
        data: response.notification.request.content.data,
        id: response.notification.request.identifier,
      });
    };
    const initialResponse = Notifications.getLastNotificationResponse();
    if (initialResponse) emit(initialResponse);
    subscription = Notifications.addNotificationResponseReceivedListener(emit);
  });

  return () => {
    active = false;
    subscription?.remove();
  };
}

async function uploadPushToken(Notifications: NotificationsModule) {
  const eas = projectId();
  if (!eas) throw new Error('푸시 알림 프로젝트 설정을 찾을 수 없습니다.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: eas });
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await mutateMobileApi('/api/mobile/v1/me', 'PATCH', { pushToken: { token, platform } });
}

export async function getPushPermissionStatus(): Promise<PushPermissionSnapshot> {
  const Notifications = await loadNotifications();
  if (!Notifications) return { canAskAgain: false, status: 'unsupported' };
  const permission = await Notifications.getPermissionsAsync();
  return permissionSnapshot(Notifications, permission);
}

/** 이미 허용된 기기만 토큰을 동기화한다. 로그인과 세션 복원 중에는 OS 권한을 요청하지 않는다. */
export async function syncPushTokenIfAuthorized(): Promise<PushPermissionSnapshot> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return { canAskAgain: false, status: 'unsupported' };
    await prepareAndroidChannels(Notifications);
    const permission = await Notifications.getPermissionsAsync();
    const snapshot = permissionSnapshot(Notifications, permission);
    if (snapshot.status === 'granted') await uploadPushToken(Notifications);
    return snapshot;
  } catch (error) {
    console.log('[push] syncPushTokenIfAuthorized failed:', error);
    return { canAskAgain: false, status: 'unsupported' };
  }
}

/** 사용자가 알림 받기를 직접 선택한 순간에만 호출한다. */
export async function requestPushPermissionAndRegister(): Promise<PushPermissionSnapshot> {
  const Notifications = await loadNotifications();
  if (!Notifications) return { canAskAgain: false, status: 'unsupported' };
  await prepareAndroidChannels(Notifications);
  let permission = await Notifications.getPermissionsAsync();
  let snapshot = permissionSnapshot(Notifications, permission);
  if (snapshot.status === 'undetermined' && snapshot.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    snapshot = permissionSnapshot(Notifications, permission);
  }
  if (snapshot.status === 'granted') await uploadPushToken(Notifications);
  return snapshot;
}

export async function openPushNotificationSettings() {
  await Linking.openSettings();
}

/** 로그아웃 직전 호출: 이 기기의 push token을 서버에서 해제한다. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    const eas = projectId();
    if (!eas) return;

    const permission = await Notifications.getPermissionsAsync();
    if (!permissionGranted(Notifications, permission)) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: eas });
    await mutateMobileApi('/api/mobile/v1/me', 'PATCH', { removePushToken: token });
  } catch {
    // 로그아웃 자체는 계속 진행되어야 한다.
  }
}
