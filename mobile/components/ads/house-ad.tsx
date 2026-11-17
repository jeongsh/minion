import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

// hideOn: path segments where the promo is redundant, also under team pages (/fan/{team}/community).
export type HousePromo = { href: string; label: string; image: number; android?: boolean; hideOn?: string[] };

// Internal promotions shown when an ad placement has no fill.
// Images are 1170x180 (390x60 at 3x); key content stays in the center 960x180.
const PROMOS: HousePromo[] = [
  { href: '/community', label: '팬톡, 응원도 수다도 함께', image: require('@/assets/house-ads/fantalk.jpg') },
  { href: '/predictions', label: '승부예측, 오늘의 승리팀은?', image: require('@/assets/house-ads/predictions.jpg'), android: true },
  { href: '/transfers', label: '이적시장, 새로운 팀 새로운 시작', image: require('@/assets/house-ads/transfers.jpg') },
  { href: '/schedule', label: '일정 및 매치, 오늘 경기는 언제?', image: require('@/assets/house-ads/schedule.jpg'), hideOn: ['/schedule', '/matches'] },
];

// Placements currently wanting a house ad, per page, in mount order. Each one
// takes the next promo so a page never shows the same banner twice.
const pages = new Map<string, string[]>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version += 1; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getVersion = () => version;

function register(pathname: string, placement: string) {
  const list = pages.get(pathname) ?? [];
  if (!list.includes(placement)) { pages.set(pathname, [...list, placement]); notify(); }
  return () => {
    const next = (pages.get(pathname) ?? []).filter(item => item !== placement);
    if (next.length) pages.set(pathname, next); else pages.delete(pathname);
    notify();
  };
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
}

/** The promo for this placement, or null when inactive or every distinct promo is already on the page. */
export function useHousePromo(placement: string, active: boolean): HousePromo | null {
  // usePathname follows the focused route. Screens kept mounted behind it (tabs,
  // stack) must stay keyed to their own page, so capture the path at mount.
  const currentPath = usePathname();
  const [pathname] = useState(currentPath);
  useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => active ? register(pathname, placement) : undefined, [active, pathname, placement]);
  if (!active) return null;
  const candidates = PROMOS.filter(promo => (!promo.android || Platform.OS === 'android') && !(promo.hideOn ?? [promo.href]).some(path => pathname.includes(path)));
  const list = pages.get(pathname) ?? [];
  const order = list.indexOf(placement);
  const index = order < 0 ? list.length : order;
  if (index >= candidates.length) return null;
  return candidates[(hash(pathname) + index) % candidates.length];
}

export function HouseAd({ promo, height }: { promo: HousePromo; height: number }) {
  const router = useRouter();
  return (
    <Pressable accessibilityLabel={promo.label} accessibilityRole="link" onPress={() => router.push(promo.href as never)} style={({ pressed }) => [styles.root, { height, opacity: pressed ? 0.85 : 1 }]}>
      <Image contentFit="cover" contentPosition="center" source={promo.image} style={StyleSheet.absoluteFill} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', overflow: 'hidden' },
});
