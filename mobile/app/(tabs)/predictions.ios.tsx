import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { MinionScreen } from '@/components/minion-screen';

export default function PredictionsScreen() {
  const router = useRouter();
  const alertOpen = useRef(false);

  useFocusEffect(useCallback(() => {
    if (alertOpen.current) return;
    alertOpen.current = true;
    Alert.alert('승부예측 안내', 'iOS 앱에서는 승부예측 기능을 제공하지 않습니다.', [
      {
        text: '확인',
        onPress: () => {
          alertOpen.current = false;
          router.replace('/');
        },
      },
    ]);
  }, [router]));

  return <MinionScreen />;
}
