import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { mutateMobileApi } from '@/lib/api-client';

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

// 앱이 켜져있을 때(포그라운드) 도착한 푸시는 시스템 배너 대신 앱 안에서 토스트로만
// 보여준다 — 이미 보고 있는 화면 위에 OS 알림 배너까지 뜨면 과하기 때문. 백그라운드/
// 종료 상태일 땐 이 핸들러가 아예 호출되지 않아 시스템 알림이 평소처럼 뜬다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** 포그라운드에서 도착한 푸시를 토스트로 보여주기 위해 구독한다. RootLayout에서 한 번만 호출. */
export function subscribeToForegroundPushToasts(showToast: (message: string, tone?: 'success' | 'info' | 'error') => void) {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    const { title, body } = notification.request.content;
    const message = [title, body].filter(Boolean).join(' — ');
    if (message) showToast(message, 'info');
  });
  return () => subscription.remove();
}

/** 로그인 직후 호출: 권한을 요청하고 Expo push token을 서버에 등록한다. 실패해도 조용히 무시한다(알림은 부가 기능). */
export async function registerPushToken(): Promise<void> {
  try {
    console.log('[push] registerPushToken start, isDevice =', Device.isDevice);
    const eas = projectId();
    console.log('[push] projectId =', eas);
    if (!eas) return;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    console.log('[push] existing permission status =', status);
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
      console.log('[push] requested permission status =', status);
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: eas });
    console.log('[push] expo push token:', token);
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await mutateMobileApi('/api/mobile/v1/me', 'PATCH', { pushToken: { token, platform } });
  } catch (error) {
    console.log('[push] registerPushToken failed:', error);
  }
}

/** 로그아웃 직전 호출: 이 기기의 push token을 서버에서 해제한다. */
export async function unregisterPushToken(): Promise<void> {
  try {
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
