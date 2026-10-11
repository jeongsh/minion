import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { getMobileAdsState, showAdsPrivacyOptions, subscribeMobileAds } from '@/lib/mobile-ads';

export function AdsPrivacyOptions() {
  const { fonts, showToast, theme } = useMinionTheme();
  const { privacyOptionsRequired } = useSyncExternalStore(subscribeMobileAds, getMobileAdsState, getMobileAdsState);
  const [busy, setBusy] = useState(false);
  if (!privacyOptionsRequired) return null;
  return <Pressable accessibilityRole="button" disabled={busy} onPress={async () => {
    setBusy(true);
    try { await showAdsPrivacyOptions(); }
    catch { showToast('광고 개인정보 설정을 열지 못했습니다.', 'error'); }
    finally { setBusy(false); }
  }}><Text style={{ color: theme.footerNav, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>광고 개인정보 설정</Text></Pressable>;
}
