import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TOURNAMENT_LOGO_ASSETS } from '@/constants/tournament-segments';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTournamentDetailDto } from '@/lib/api-client';

export function TournamentHeader({ segment, action }: { segment: MobileTournamentDetailDto['segment']; action?: ReactNode }) {
  const { fonts, theme } = useMinionTheme();
  const logo = segment.logo ? TOURNAMENT_LOGO_ASSETS[segment.logo] : undefined;
  const logoWidth = Math.min(62, 28 * segment.logoAspect);

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.titleGroup}>
          {logo ? <Image contentFit="contain" source={logo} style={{ height: 28, width: logoWidth }} tintColor={theme.ink} /> : null}
          <Text numberOfLines={1} style={[styles.title, { color: theme.ink, fontFamily: fonts.display }]}>{segment.name}</Text>
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  header: { gap: 12 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  title: { flexShrink: 1, fontSize: 20, lineHeight: 27 },
  titleGroup: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
});
