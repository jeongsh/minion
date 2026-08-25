import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';

const TIERS = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'] as const;
type Tier = typeof TIERS[number];

const TIER_LABELS: Record<Tier, string> = {
  iron: '아이언', bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', emerald: '에메랄드', diamond: '다이아', master: '마스터', grandmaster: '그랜드마스터', challenger: '챌린저',
};

type Finish = {
  gem: readonly [string, string, string];
  medal: readonly [string, string, string];
  ring: readonly [string, string, string, string];
  shadow: string;
};

const TIER_FINISHES: Record<Tier, Finish> = {
  iron: { ring: ['#a99b92', '#3b3537', '#756b67', '#c0b0a4'], medal: ['#a99c94', '#2f2b2f', '#756b67'], gem: ['#d8dde2', '#626a73', '#20242a'], shadow: '#363031' },
  bronze: { ring: ['#e09a7d', '#713827', '#b86145', '#f0b092'], medal: ['#efaa88', '#743724', '#bd684d'], gem: ['#ffd1b8', '#c26b4c', '#652716'], shadow: '#753724' },
  silver: { ring: ['#f3f7fb', '#738297', '#c5d2df', '#ffffff'], medal: ['#f7fbff', '#657589', '#c6d1dc'], gem: ['#ffffff', '#a8c0d6', '#53687b'], shadow: '#4e5d6f' },
  gold: { ring: ['#ffe38a', '#9a5d0c', '#d99b27', '#fff0a3'], medal: ['#ffe68d', '#9b5a08', '#e1a128'], gem: ['#fff6a8', '#ffc400', '#a96800'], shadow: '#975b09' },
  platinum: { ring: ['#8ff5ff', '#087f9e', '#14c8e8', '#b2fbff'], medal: ['#b8fbff', '#087994', '#25cde8'], gem: ['#d9ffff', '#00bce8', '#006f99'], shadow: '#00809d' },
  emerald: { ring: ['#9af7ba', '#08773c', '#24c967', '#c0ffd3'], medal: ['#aef6c3', '#087439', '#27c96a'], gem: ['#caffdb', '#10b95a', '#006a32'], shadow: '#057036' },
  diamond: { ring: ['#84e8ff', '#374bb9', '#735af0', '#a8f3ff'], medal: ['#a8f2ff', '#3141a0', '#7968f4'], gem: ['#d7fbff', '#287dff', '#5624c7'], shadow: '#393ca4' },
  master: { ring: ['#f5a2ff', '#7125a3', '#c43bd6', '#ffd0ff'], medal: ['#f7b7ff', '#6b2099', '#cf42dc'], gem: ['#ffd4ff', '#c13ee8', '#67138d'], shadow: '#701f91' },
  grandmaster: { ring: ['#ffb17d', '#8f1d12', '#ee4826', '#ffd096'], medal: ['#ffc091', '#8b1b0e', '#ed5128'], gem: ['#ffe3a6', '#ff5b12', '#9e1907'], shadow: '#8b1e0f' },
  challenger: { ring: ['#39e4ff', '#3b83ed', '#ffe68a', '#397ce5'], medal: ['#fff8c9', '#e7bd4d', '#3178dc'], gem: ['#fff8bf', '#55ebff', '#287ce9'], shadow: '#29bada' },
};

function normalizeTier(value: string | null | undefined): Tier {
  return TIERS.includes(value as Tier) ? value as Tier : 'bronze';
}

export function RankAvatar({ fallback = 'MY', profileImageUrl, size = 'compact', tier }: { fallback?: string; profileImageUrl?: string | null; size?: 'compact' | 'comment' | 'detail' | 'mobile' | 'profile' | 'large'; tier?: string | null }) {
  const { fonts, theme } = useMinionTheme();
  const normalizedTier = normalizeTier(tier);
  const finish = TIER_FINISHES[normalizedTier];
  const uri = resolveApiAssetUrl(profileImageUrl);

  const scaled = size === 'compact';
  const dimensions = size === 'large'
    ? { avatar: 96, frameInset: 4, frameRadius: 44, medal: 22, medalBottom: -4, medalLeft: 37, ringRadius: 48 }
    : size === 'profile'
    ? { avatar: 72, frameInset: 3.5, frameRadius: 32.5, medal: 18, medalBottom: -3, medalLeft: 27, ringRadius: 36 }
    : size === 'mobile'
      ? { avatar: 56, frameInset: 3, frameRadius: 25, medal: 14, medalBottom: -3, medalLeft: 21, ringRadius: 28 }
      : size === 'detail'
        ? { avatar: 36, frameInset: 2.75, frameRadius: 15.25, medal: 11, medalBottom: -2, medalLeft: 12.5, ringRadius: 18 }
        : { avatar: 32, frameInset: 2.5, frameRadius: 13.5, medal: 10, medalBottom: -2, medalLeft: 11, ringRadius: 16 };
  return (
    <View accessibilityLabel={`${TIER_LABELS[normalizedTier]} 티어 프로필`} accessibilityRole="image" style={{ alignItems: 'center', height: dimensions.avatar, justifyContent: 'center', width: dimensions.avatar }}>
      <View style={[styles.avatar, { borderRadius: dimensions.ringRadius, height: dimensions.avatar, shadowColor: finish.shadow, transform: scaled ? [{ scale: 0.875 }] : undefined, width: dimensions.avatar }]}> 
        <LinearGradient colors={finish.ring} end={{ x: 1, y: 1 }} locations={[0, 0.42, 0.72, 1]} start={{ x: 0, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: dimensions.ringRadius }]} />
        <View pointerEvents="none" style={[styles.outerStroke, { borderRadius: dimensions.ringRadius + 1 }]} />
        <View pointerEvents="none" style={[styles.topHighlight, { borderRadius: dimensions.ringRadius }]} />
        <View style={[styles.imageFrame, { backgroundColor: theme.surfaceMuted, borderRadius: dimensions.frameRadius, bottom: dimensions.frameInset, left: dimensions.frameInset, right: dimensions.frameInset, top: dimensions.frameInset }]}>
          {uri ? (
            <Image contentFit="cover" source={{ uri }} style={[StyleSheet.absoluteFill, { borderRadius: dimensions.frameRadius }]} />
          ) : (
            <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: size === 'large' ? 27 : size === 'profile' ? 20 : size === 'mobile' ? 16 : size === 'detail' ? 11 : 10, lineHeight: size === 'large' ? 32 : size === 'profile' ? 24 : size === 'mobile' ? 20 : size === 'detail' ? 14 : 12 }}>{fallback.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <Svg height={dimensions.medal * 1.08} style={[styles.medal, { bottom: dimensions.medalBottom, left: dimensions.medalLeft, shadowColor: finish.shadow }]} viewBox="0 0 10 10.8" width={dimensions.medal}>
          <Defs>
            <SvgLinearGradient id="medal" x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor={finish.medal[0]} /><Stop offset="0.58" stopColor={finish.medal[1]} /><Stop offset="1" stopColor={finish.medal[2]} /></SvgLinearGradient>
            <SvgLinearGradient id="gem" x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor={finish.gem[0]} /><Stop offset="0.48" stopColor={finish.gem[1]} /><Stop offset="1" stopColor={finish.gem[2]} /></SvgLinearGradient>
          </Defs>
          <Path d="M5 0 9.2 3.024 8.8 8.1 5 10.8 1.2 8.1.8 3.024Z" fill="url(#medal)" />
          <Path d="M5 2.16 7.352 4.164 6.568 7.297 5 8.424 3.432 7.297 2.648 4.164Z" fill="url(#gem)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { elevation: 3, position: 'relative', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
  outerStroke: { borderColor: 'rgba(11,17,27,0.72)', borderRadius: 17, borderWidth: 1, bottom: -1, left: -1, position: 'absolute', right: -1, top: -1 },
  topHighlight: { ...StyleSheet.absoluteFillObject, borderColor: 'transparent', borderTopColor: 'rgba(255,255,255,0.72)', borderWidth: 1 },
  imageFrame: { alignItems: 'center', borderColor: 'rgba(0,0,0,0.45)', borderWidth: 1, justifyContent: 'center', overflow: 'hidden', position: 'absolute' },
  medal: { position: 'absolute', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.5, shadowRadius: 1 },
});
