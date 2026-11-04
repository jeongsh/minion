import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { mobileApiOrigin } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

// iOS 비회원은 App Store 1.2 대응으로 글·댓글 작성 전 이용약관에 한 번 동의한다. 동의는 기기에 저장한다.
// 회원은 가입 시 동의했고 웹과 Android는 기존 흐름을 유지한다.
const GUEST_WRITE_CONSENT_KEY = 'minion-community-guest-write-consent-v1';

let cachedConsent: boolean | null = null;

export function useGuestWriteConsent() {
  const { session } = useAuth();
  const required = Platform.OS === 'ios' && !session;
  const [accepted, setAcceptedState] = useState(cachedConsent ?? false);

  useEffect(() => {
    if (!required || cachedConsent !== null) return;
    let active = true;
    void AsyncStorage.getItem(GUEST_WRITE_CONSENT_KEY).then((value) => {
      cachedConsent = value === 'true';
      if (active) setAcceptedState(cachedConsent);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [required]);

  const setAccepted = useCallback((next: boolean) => {
    cachedConsent = next;
    setAcceptedState(next);
    void AsyncStorage.setItem(GUEST_WRITE_CONSENT_KEY, String(next)).catch(() => undefined);
  }, []);

  // 동의 전 작성 시 약관 확인과 동의를 묻는다. 동의하면 onAccepted로 작성을 이어간다.
  const ensureConsent = useCallback((onAccepted: () => void) => {
    if (!required || accepted) return true;
    Alert.alert('이용약관 동의', '글과 댓글을 작성하려면 이용약관과 커뮤니티 운영원칙에 동의해주세요. 부적절한 콘텐츠와 악성 이용자는 무관용 원칙으로 조치됩니다.', [
      { style: 'cancel', text: '취소' },
      { onPress: () => void Linking.openURL(`${mobileApiOrigin}/terms`), text: '약관 보기' },
      { onPress: () => { setAccepted(true); onAccepted(); }, text: '동의하고 등록' },
    ]);
    return false;
  }, [accepted, required, setAccepted]);

  return { accepted, ensureConsent, required, setAccepted };
}
