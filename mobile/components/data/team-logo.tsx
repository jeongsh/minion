import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamSummary } from '@/lib/api-client';

type Props = {
  plain?: boolean;
  size?: number;
  team?: MobileTeamSummary | null;
  themeAware?: boolean;
};

/** 웹 TeamLogo와 동일한 72% 로고·원형 muted 배경·plain 규칙을 사용한다. */
export function TeamLogo({ plain = false, size = 40, team, themeAware = false }: Props) {
  const { colorScheme, theme } = useMinionTheme();
  const preferred = themeAware && colorScheme === 'dark' && team?.useWhiteLogoOnDark && team.logoDark
    ? team.logoDark.url
    : team?.logo?.url;
  const uri = resolveApiAssetUrl(preferred);

  if (!uri) {
    return <View accessibilityLabel={team?.name ?? '미정 팀'} accessibilityRole="image" style={[styles.fallback, { borderColor: theme.muted, height: size, width: size }]} />;
  }

  const imageSize = plain ? size : size * 0.72;
  // Native image decoders cannot reliably render SVG patterns containing embedded images.
  // Keep the API URL and render SVG markup with the existing native SVG library.
  const nativeSvg = Platform.OS !== 'web' && /\.svg(?:[?#]|$)/i.test(uri);
  return (
    <View style={[styles.container, { backgroundColor: plain ? 'transparent' : theme.surfaceMuted, borderRadius: plain ? 0 : size / 2, height: size, width: size }]}>
      {nativeSvg
        ? <SvgUri key={uri} uri={uri} width={imageSize} height={imageSize} preserveAspectRatio="xMidYMid meet" />
        : <Image contentFit="contain" source={{ uri }} style={{ height: imageSize, width: imageSize }} transition={150} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fallback: { borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, opacity: 0.6 },
});
