import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { mutateMobileApi } from '@/lib/api-client';

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
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
    if (!Device.isDevice) return;
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
