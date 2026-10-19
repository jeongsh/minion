import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScheduleDialogChrome } from '@/components/schedule/schedule-dialog-chrome';
import { TOURNAMENT_LOGO_ASSETS } from '@/constants/tournament-segments';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';

export type TournamentFilterGroup = {
  label: string;
  selected: string;
  onSelect: (value: string) => void;
  options: { value: string; label: string; logo?: string | null; logoAspect?: number; isOngoing?: boolean }[];
};

export function TournamentFilterSheet({ groups, onClose, open }: { groups: TournamentFilterGroup[]; onClose: () => void; open: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return <ScheduleDialogChrome title="대회 필터" open={open} onClose={onClose}>
    <View style={styles.groups}>{groups.map(group => <View key={group.label}>
      <Text style={[styles.label, { color: theme.muted, ...fonts.medium }]}>{group.label}</Text>
      <View style={styles.options}>{group.options.map(option => {
        const active = option.value === group.selected;
        const ink = active ? theme.surface : theme.ink;
        const logo = option.logo ? TOURNAMENT_LOGO_ASSETS[option.logo] ?? resolveApiAssetUrl(option.logo) : undefined;
        return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={option.value} onPress={() => { group.onSelect(option.value); onClose(); }} style={[styles.option, { backgroundColor: active ? theme.ink : theme.card }]}>
          {logo ? <View style={styles.logoBox}><Image source={logo} contentFit="contain" tintColor={ink} style={{ height: 20, width: Math.min(32, 20 * (option.logoAspect ?? 1.4)) }} /></View> : null}
          <Text style={[styles.optionText, { color: ink, ...fonts.medium }]}>{option.label}</Text>
          {option.isOngoing ? <View accessibilityLabel="진행 중" style={styles.dot} /> : null}
        </Pressable>;
      })}</View>
    </View>)}</View>
  </ScheduleDialogChrome>;
}

const styles = StyleSheet.create({
  dot: { backgroundColor: '#10b981', borderRadius: 3, height: 6, width: 6 },
  groups: { gap: 16 },
  label: { fontSize: 13, lineHeight: 19.5, marginBottom: 8 },
  logoBox: { alignItems: 'center', height: 20, justifyContent: 'center', width: 32 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  optionText: { fontSize: 14, lineHeight: 20 },
});
