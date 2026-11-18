import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMinionTheme } from '@/hooks/use-minion-theme';

/** Mobile translation of the web shell's SegmentedControl and SegmentedToggle. */
export function ShellSegmentedControl<T extends string>({ items, selected, onSelect, label, stretch = false, disabled = false }: {
  items: { value: T; label: string }[]; selected: T; onSelect: (value: T) => void; label: string; stretch?: boolean; disabled?: boolean;
}) {
  const { colorScheme, fonts, theme } = useMinionTheme();
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.track, { backgroundColor: theme.card }, stretch && styles.stretch]}>
    {items.map((item) => {
      const active = item.value === selected;
      return <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: active, disabled }} aria-selected={active} disabled={disabled} onPress={() => onSelect(item.value)} style={[styles.item, stretch && { flex: 1 }, { borderColor: active ? theme.border : 'transparent', backgroundColor: active ? colorScheme === 'dark' ? theme.border : theme.surface : 'transparent' }]}><Text style={{ color: active ? theme.ink : theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{item.label}</Text></Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  track: { alignSelf: 'flex-start', borderRadius: 10, flexDirection: 'row', gap: 2, height: 40, padding: 3 },
  stretch: { alignSelf: 'stretch' },
  item: { alignItems: 'center', borderRadius: 8, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 14 },
});
