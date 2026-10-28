import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { ANDROID_BANNER_AD_UNIT_ID, MOBILE_ADS_TEST_MODE } from '@/constants/mobile-ads';
import { useKeyboardLayout } from '@/hooks/use-keyboard-layout';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { getMobileAdsSdk, getMobileAdsState, initializeMobileAds, subscribeMobileAds } from '@/lib/mobile-ads';

export function ContentBanner({ enabled = true, style }: { enabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { keyboardVisible } = useKeyboardLayout();
  const { fonts, theme } = useMinionTheme();
  const state = useSyncExternalStore(subscribeMobileAds, getMobileAdsState, getMobileAdsState);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [requested, setRequested] = useState(false);
  const slotRef = useRef<View>(null);
  const { height: screenHeight } = useWindowDimensions();
  const ads = getMobileAdsSdk();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (enabled && focused && foreground && !keyboardVisible) void initializeMobileAds();
  }, [enabled, focused, foreground, keyboardVisible]);
  useEffect(() => { setFailed(false); }, [focused, state.revision]);
  useEffect(() => {
    if (!enabled || !focused || !foreground || keyboardVisible || !ads || !state.ready || failed) {
      setVisible(false);
      setRequested(false);
      return;
    }
    // Only request while the entire banner is clear of sticky headers, dock,
    // comment composer and floating calendar/filter buttons.
    const checkViewport = () => slotRef.current?.measureInWindow((_x, y, measuredWidth) => {
      const bannerTop = y + 24 + 19.5 + 8;
      const safe = measuredWidth >= 320 && bannerTop >= insets.top + 60 && bannerTop + 50 <= screenHeight - insets.bottom - 80;
      setVisible(safe);
      if (safe) setRequested(true);
    });
    checkViewport();
    const interval = setInterval(checkViewport, 350);
    return () => clearInterval(interval);
  }, [ads, enabled, failed, focused, foreground, keyboardVisible, screenHeight, insets.top, insets.bottom, state.ready]);

  if (!enabled || !focused || !foreground || keyboardVisible || !ads || !state.ready || failed) return null;
  const BannerAd = ads.BannerAd;
  return (
    <View collapsable={false} ref={slotRef} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.slot, style, width > 0 && width < 320 ? { minHeight: 0, paddingVertical: 0 } : null]}>
      {width >= 320 && requested ? <View pointerEvents={visible ? 'auto' : 'none'} style={{ opacity: visible ? 1 : 0, alignItems: 'center' }}>
        <Text style={[styles.label, { color: theme.muted, ...fonts.regular }]}>광고</Text>
        <View style={styles.banner}>
          <BannerAd key={state.revision} onAdFailedToLoad={() => setFailed(true)} size={ads.BannerAdSize.BANNER} unitId={MOBILE_ADS_TEST_MODE ? ads.TestIds.BANNER : ANDROID_BANNER_AD_UNIT_ID} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', alignSelf: 'stretch', minHeight: 125.5, paddingVertical: 24 },
  label: { fontSize: 13, lineHeight: 19.5, marginBottom: 8 },
  banner: { height: 50, width: 320 },
});
