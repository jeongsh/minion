import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamSummary } from '@/lib/api-client';

const rasterTeamLogos = {
  cfo: require('@/assets/team-logos/cfo.png'),
  dcg: require('@/assets/team-logos/dcg.png'),
  'dcg-white': require('@/assets/team-logos/dcg-white.png'),
  ig: require('@/assets/team-logos/ig.png'),
  'ig-white': require('@/assets/team-logos/ig-white.png'),
  lgd: require('@/assets/team-logos/lgd.png'),
  mvk: require('@/assets/team-logos/mvk.png'),
  vit: require('@/assets/team-logos/vit.png'),
  we: require('@/assets/team-logos/we.png'),
};

function rasterLogoForUrl(url?: string | null) {
  const filename = url?.split(/[?#]/, 1)[0]?.split('/').pop()?.toLowerCase();
  const key = filename?.match(/^([a-z0-9-]+)\.svg$/)?.[1] as keyof typeof rasterTeamLogos | undefined;
  return key ? rasterTeamLogos[key] : null;
}

function rasterLogoForTeam(team?: MobileTeamSummary | null) {
  const aliases: Record<string, keyof typeof rasterTeamLogos> = {
    'team vitality': 'vit',
    'team-vitality': 'vit',
    vitality: 'vit',
  };
  const identifiers = [team?.shortName, team?.slug, team?.name]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  for (const identifier of identifiers) {
    const key = aliases[identifier] ?? identifier as keyof typeof rasterTeamLogos;
    if (key in rasterTeamLogos) return rasterTeamLogos[key];
  }
  return null;
}

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
  const source = rasterLogoForUrl(preferred) ?? rasterLogoForTeam(team) ?? (uri ? { uri } : null);

  if (!source) {
    return <View accessibilityLabel={team?.name ?? '미정 팀'} accessibilityRole="image" style={[styles.fallback, { borderColor: theme.muted, height: size, width: size }]} />;
  }

  const imageSize = plain ? size : size * 0.72;
  return <View style={[styles.container, { backgroundColor: plain ? 'transparent' : theme.surfaceMuted, borderRadius: plain ? 0 : size / 2, height: size, width: size }]}><Image contentFit="contain" source={source} style={{ height: imageSize, width: imageSize }} transition={150} /></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fallback: { borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, opacity: 0.6 },
});
