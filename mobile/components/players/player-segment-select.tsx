import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';

export function PlayerSegmentSelect({ accent, activeSegment, onClose, onOpen, onSelect, open, options }: {
  accent: string;
  activeSegment: string;
  onClose: () => void;
  onOpen: () => void;
  onSelect: (value: string) => void;
  open: boolean;
  options: { value: string; label: string }[];
}) {
  const { fonts, theme } = useMinionTheme();
  const selected = options.find((option) => option.value === activeSegment);
  return (
    <>
      <Pressable
        accessibilityLabel="대회 구간"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onOpen}
        style={[styles.control, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text numberOfLines={1} style={{ color: theme.ink, flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>{selected?.label ?? '-'}</Text>
        <ChevronDown color={theme.muted} size={16} />
      </Pressable>
      <BottomSheet contentStyle={styles.options} onClose={onClose} open={open} title="대회 구간">
        {options.map((option) => {
          const active = option.value === activeSegment;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.cardHover }]}>
              <Text style={{ color: active ? accent : theme.text, flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 }}>{option.label}</Text>
              {active ? <Check color={accent} size={19} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  control: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 44, paddingHorizontal: 12 },
  option: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', minHeight: 48, paddingHorizontal: 14 },
  options: { paddingBottom: 8, paddingHorizontal: 8 },
});
