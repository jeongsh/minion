import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin } from '@/lib/api-client';

// iOS는 App Store 1.2 대응으로 첫 실행 시 이용약관에 한 번 동의해야 앱을 쓸 수 있다. 로그인·가입·비회원 작성 동의를 함께 대신한다.
// 웹과 Android는 기존 흐름을 유지한다.
const IOS_TERMS_CONSENT_KEY = 'minion-ios-terms-consent-v1';
// 이전 빌드의 iOS 로그인 화면에서 같은 항목에 동의한 기기는 다시 묻지 않는다.
const LEGACY_AUTH_CONSENT_KEY = 'minion-auth-consent-v1';

type ConsentState = 'loading' | 'required' | 'accepted';
let state: ConsentState = Platform.OS === 'ios' ? 'loading' : 'accepted';
const listeners = new Set<() => void>();
const setState = (next: ConsentState) => { state = next; listeners.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

if (state === 'loading') {
  void AsyncStorage.multiGet([IOS_TERMS_CONSENT_KEY, LEGACY_AUTH_CONSENT_KEY])
    .then((entries) => setState(entries.some(([, value]) => value === 'true') ? 'accepted' : 'required'))
    .catch(() => setState('required'));
}

export function useIosTermsAccepted() {
  return useSyncExternalStore(subscribe, () => state === 'accepted');
}

export function IosTermsGate() {
  const { fonts, theme } = useMinionTheme();
  const current = useSyncExternalStore(subscribe, () => state);
  if (current !== 'required') return null;

  const accept = () => {
    setState('accepted');
    void AsyncStorage.setItem(IOS_TERMS_CONSENT_KEY, 'true').catch(() => undefined);
  };

  return (
    <BottomSheet dismissible={false} onClose={() => undefined} open title="이용약관 동의">
      <Text style={[styles.body, { color: theme.text, ...fonts.regular }]}>App Store 정책에 따라 iOS 앱은 처음 한 번 이용약관 동의가 필요해요. 동의하면 로그인과 글쓰기에서 다시 묻지 않아요.</Text>
      <View style={[styles.summary, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <Text style={[styles.body, { color: theme.text, ...fonts.regular }]}>욕설·혐오·음란물 등 부적절한 콘텐츠와 악성 이용자는 무관용 원칙으로 조치해요. 신고된 콘텐츠는 24시간 안에 검토해 삭제하고 작성자의 이용을 제한해요.</Text>
      </View>
      <Text style={[styles.agreement, { color: theme.text, ...fonts.medium }]}>
        만 14세 이상이며{' '}
        <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${mobileApiOrigin}/terms`)} style={styles.link}>이용약관</Text>
        {' 및 '}
        <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${mobileApiOrigin}/privacy`)} style={styles.link}>개인정보처리방침</Text>
        에 동의해요.
      </Text>
      <Pressable accessibilityRole="button" onPress={accept} style={[styles.primary, { backgroundColor: theme.ink }]}>
        <Text style={[styles.buttonText, { color: theme.surface, ...fonts.medium }]}>동의하고 시작</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24 },
  summary: { borderRadius: 10, borderWidth: 1, marginTop: 14, padding: 12 },
  agreement: { fontSize: 14, lineHeight: 20, marginTop: 14 },
  link: { textDecorationLine: 'underline' },
  primary: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', marginBottom: 4, marginTop: 16 },
  buttonText: { fontSize: 14, lineHeight: 20 },
});
