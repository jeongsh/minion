import { useIsFocused } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { getAndroidBannerAdUnitId, MOBILE_ADS_TEST_MODE } from '@/constants/mobile-ads';
import { useKeyboardLayout } from '@/hooks/use-keyboard-layout';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { bannerRequestDelay, isBannerUnfilled, recordBannerFailure, recordBannerLoaded, recordBannerRequest } from '@/lib/ad-banner-policy';
import { getAdContentUrl } from '@/lib/ad-content-url';
import { notifyAdViewportChanged, subscribeAdViewport } from '@/lib/ad-viewport';
import { getMobileAdsSdk, getMobileAdsState, initializeMobileAds, subscribeMobileAds } from '@/lib/mobile-ads';

// Matches the published Android privacy policy. UMP still applies any stricter
// consent restrictions; do not turn this off as a workaround for no-fill.
const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
const PLACEHOLDER_HEIGHT = 100;
type BannerDimensions = { width: number; height: number };

type Props = { enabled?: boolean; suspended?: boolean; placement: string; style?: StyleProp<ViewStyle> };

export function ContentBanner({ enabled = true, suspended = false, placement, style }: Props) {
  const focused = useIsFocused();
  const pathname = usePathname();
  const { keyboardVisible } = useKeyboardLayout();
  const state = useSyncExternalStore(subscribeMobileAds, getMobileAdsState, getMobileAdsState);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [width, setWidth] = useState(0);
  const [reservedHeight, setReservedHeight] = useState(PLACEHOLDER_HEIGHT);
  const [nearViewport, setNearViewport] = useState(false);
  const [unfilled, setUnfilled] = useState(() => isBannerUnfilled(placement));
  const slot = useRef<View>(null);
  const window = useWindowDimensions();
  const ads = getMobileAdsSdk();
  const screenVisible = focused && foreground;
  const active = enabled && screenVisible && !keyboardVisible && !suspended;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setForeground(next === 'active'));
    return () => subscription.remove();
  }, []);
  // A removed placement returns on a later visit once its request cooldown ends.
  useEffect(() => {
    if (screenVisible) setUnfilled(isBannerUnfilled(placement));
  }, [placement, screenVisible]);
  useEffect(() => {
    if (!enabled || !screenVisible || unfilled) {
      setNearViewport(false);
      return;
    }
    if (!ads || nearViewport) return;
    let current = true;
    // Request one screen ahead so most loads and removals settle offscreen.
    const measure = () => slot.current?.measureInWindow((_x, y, measuredWidth, height) => {
      if (current && measuredWidth >= 320 && height > 0 && y + height > 0 && y < window.height * 2) setNearViewport(true);
    });
    const unsubscribe = subscribeAdViewport(measure);
    measure();
    notifyAdViewportChanged();
    return () => { current = false; unsubscribe(); };
  }, [ads, enabled, screenVisible, unfilled, nearViewport, window.height, window.width]);
  useEffect(() => {
    if (!active || !nearViewport) return;
    const delay = state.retryAt === null ? 0 : Math.max(0, state.retryAt - Date.now());
    if (!delay) { void initializeMobileAds(); return; }
    const timer = setTimeout(() => { void initializeMobileAds(); }, delay);
    return () => clearTimeout(timer);
  }, [active, nearViewport, state.retryAt]);

  if (!enabled || !ads || unfilled) return null;
  // Keep measurement independent of the creative; its height follows SDK events.
  return <View ref={slot} collapsable={false} onLayout={event => { setWidth(Math.floor(event.nativeEvent.layout.width)); notifyAdViewportChanged(); }} style={[styles.slot, style]}>
    {state.ready && width >= 320 && nearViewport && screenVisible ? <BannerSession key={`${state.revision}:${width}:${placement}`} active={active} ads={ads} placement={placement} contentUrl={getAdContentUrl(pathname)} width={width} reservedHeight={reservedHeight} onHeightChange={setReservedHeight} onUnfilled={() => setUnfilled(true)} /> : <BannerPlaceholder height={reservedHeight} />}
  </View>;
}

function BannerSession({ active, ads, placement, contentUrl, width, reservedHeight, onHeightChange, onUnfilled }: { active: boolean; ads: NonNullable<ReturnType<typeof getMobileAdsSdk>>; placement: string; contentUrl?: string; width: number; reservedHeight: number; onHeightChange: (height: number) => void; onUnfilled: () => void }) {
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  // A changed request prop reloads the native view. Keep the page this session started on.
  const [requestOptions] = useState(() => contentUrl ? { ...REQUEST_OPTIONS, contentUrl } : REQUEST_OPTIONS);
  useEffect(() => {
    if (!active || started) return;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      const delay = bannerRequestDelay(placement);
      if (delay > 0) { timer = setTimeout(start, delay); return; }
      recordBannerRequest(placement);
      console.info('[ads] banner request', { placement, width, nonPersonalized: true, contentMapped: requestOptions !== REQUEST_OPTIONS });
      setStarted(true);
    };
    start();
    return () => clearTimeout(timer);
  }, [active, placement, requestOptions, started, width]);

  const updateSize = (dimensions: BannerDimensions) => {
    if (Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height) && dimensions.width > 0 && dimensions.height > 0) {
      setHeight(Math.ceil(dimensions.height));
      onHeightChange(Math.ceil(dimensions.height));
    }
  };

  if (!started) return <BannerPlaceholder height={reservedHeight} />;
  const BannerAd = ads.BannerAd;
  // Keep the loaded native view mounted through scrolling and sheets. The parent
  // releases it when its screen loses focus or the app enters the background.
  // AdMob automatic refresh owns later loads and keeps a loaded creative through
  // refresh failures. A failed first load removes the slot instead, releasing
  // this view so the SDK cannot keep retrying a placement nobody can see.
  // v15.8.3 starts BaseAd at 0x0. Anchored adaptive emits a nonzero size before
  // loading, unlike inline adaptive. Keep the parent sized while that event arrives.
  return <View pointerEvents={active ? 'auto' : 'none'} style={[styles.creative, { width, height: loaded && height !== null ? height : reservedHeight }]}>
    <BannerAd size={ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER} width={width}
      unitId={MOBILE_ADS_TEST_MODE ? ads.TestIds.BANNER : getAndroidBannerAdUnitId(placement)} requestOptions={requestOptions}
      onAdLoaded={dimensions => {
        recordBannerLoaded(placement);
        updateSize(dimensions);
        setLoaded(true);
        console.info('[ads] banner loaded', { placement, ...dimensions });
      }}
      onSizeChange={updateSize}
      onAdImpression={() => console.info('[ads] banner impression', { placement })}
      onAdFailedToLoad={error => {
        recordBannerFailure(placement, error, !loaded);
        if (!loaded) onUnfilled();
      }} />
    {!loaded || height === null ? <BannerPlaceholder overlay /> : null}
  </View>;
}

function BannerPlaceholder({ overlay = false, height = PLACEHOLDER_HEIGHT }: { overlay?: boolean; height?: number }) {
  const { fonts, theme } = useMinionTheme();
  return <View pointerEvents="none" style={[styles.placeholder, overlay ? StyleSheet.absoluteFillObject : { height }, { backgroundColor: theme.surfaceMuted }]}>
    <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>광고영역</Text>
  </View>;
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', alignSelf: 'stretch', marginVertical: 12 },
  creative: { alignItems: 'center', justifyContent: 'center' },
  placeholder: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
