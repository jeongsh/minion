import { useIsFocused } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { HouseAd, useHousePromo } from '@/components/ads/house-ad';

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
// Slot height matches the phone anchored adaptive banner (about 60dp at 360-400dp
// widths), so loading, the AdMob creative and the house fallback share one size and
// the page does not shift when a request settles. A taller creative (tablets) grows it.
const SLOT_HEIGHT = 60;
// House banners are 1170x180. Size the slot by that ratio so they never crop;
// 390dp phones get 60dp, close to the anchored adaptive banner at every width.
const slotHeightFor = (width: number) => width > 0 ? Math.min(90, Math.max(50, Math.round(width * 180 / 1170))) : SLOT_HEIGHT;
type BannerDimensions = { width: number; height: number };

type Props = { enabled?: boolean; suspended?: boolean; placement: string; style?: StyleProp<ViewStyle> };

export function ContentBanner({ enabled = true, suspended = false, placement, style }: Props) {
  const focused = useIsFocused();
  const pathname = usePathname();
  const { keyboardVisible } = useKeyboardLayout();
  const state = useSyncExternalStore(subscribeMobileAds, getMobileAdsState, getMobileAdsState);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [width, setWidth] = useState(0);
  const [nearViewport, setNearViewport] = useState(false);
  const [unfilled, setUnfilled] = useState(() => isBannerUnfilled(placement));
  const slot = useRef<View>(null);
  const window = useWindowDimensions();
  // Before the first layout, assume the common 16dp page gutters so the slot rarely resizes.
  const slotHeight = slotHeightFor(width || window.width - 32);
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

  // No fill or no ad consent: keep the slot and show an internal promotion.
  const fallback = unfilled || (!state.ready && state.eligible === false);
  const housePromo = useHousePromo(placement, enabled && Boolean(ads) && fallback);

  if (!enabled || !ads) return null;
  // A page with more house slots than distinct promos drops the extra slot instead of repeating one.
  if (fallback && !housePromo) return null;
  return <View ref={slot} collapsable={false} onLayout={event => { setWidth(Math.floor(event.nativeEvent.layout.width)); notifyAdViewportChanged(); }} style={[styles.slot, { minHeight: slotHeight }, style]}>
    {fallback && housePromo ? <HouseAd promo={housePromo} height={slotHeight} />
      : state.ready && width >= 320 && nearViewport && screenVisible ? <BannerSession key={`${state.revision}:${width}:${placement}`} active={active} ads={ads} placement={placement} contentUrl={getAdContentUrl(pathname)} width={width} slotHeight={slotHeight} onUnfilled={() => setUnfilled(true)} />
      : <BannerPlaceholder height={slotHeight} />}
  </View>;
}

function BannerSession({ active, ads, placement, contentUrl, width, slotHeight, onUnfilled }: { active: boolean; ads: NonNullable<ReturnType<typeof getMobileAdsSdk>>; placement: string; contentUrl?: string; width: number; slotHeight: number; onUnfilled: () => void }) {
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
    }
  };

  if (!started) return <BannerPlaceholder height={slotHeight} />;
  const BannerAd = ads.BannerAd;
  // Keep the loaded native view mounted through scrolling and sheets. The parent
  // releases it when its screen loses focus or the app enters the background.
  // AdMob automatic refresh owns later loads and keeps a loaded creative through
  // refresh failures. A failed first load removes the slot instead, releasing
  // this view so the SDK cannot keep retrying a placement nobody can see.
  // v15.8.3 starts BaseAd at 0x0. The creative is centered inside the fixed slot.
  return <View pointerEvents={active ? 'auto' : 'none'} style={[styles.creative, { width, height: loaded && height !== null ? Math.max(slotHeight, height) : slotHeight }]}>
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
    {!loaded || height === null ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><BannerPlaceholder height={slotHeight} /></View> : null}
  </View>;
}

function BannerPlaceholder({ height }: { height: number }) {
  const { theme } = useMinionTheme();
  return <View accessibilityLabel="광고 불러오는 중" pointerEvents="none" style={[styles.placeholder, { backgroundColor: theme.surfaceMuted, height }]}>
    <ActivityIndicator color={theme.muted} size="small" />
  </View>;
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', alignSelf: 'stretch', marginVertical: 12, overflow: 'hidden' },
  creative: { alignItems: 'center', justifyContent: 'center' },
  placeholder: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
