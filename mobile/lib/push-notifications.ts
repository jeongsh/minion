import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { mutateMobileApi } from '@/lib/api-client';

export type ForegroundPushNotification = {
  body: string | null;
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  title: string | null;
};

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;

function supportsRemotePushNotifications() {
  return Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
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

/** 로그인 직후 호출: 권한을 요청하고 Expo push token을 서버에 등록한다. 실패해도 조용히 무시한다(알림은 부가 기능). */
export async function registerPushToken(): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    const eas = projectId();
    if (!eas) return;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: eas });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await mutateMobileApi('/api/mobile/v1/me', 'PATCH', { pushToken: { token, platform } });
  } catch (error) {
    console.log('[push] registerPushToken failed:', error);
  }
}

/** 로그아웃 직전 호출: 이 기기의 push token을 서버에서 해제한다. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    const eas = projectId();
    if (!eas) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: eas });
    await mutateMobileApi('/api/mobile/v1/me', 'PATCH', { removePushToken: token });
  } catch {
    // 로그아웃 자체는 계속 진행되어야 한다.
  }
}
