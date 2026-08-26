import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export type FilterSelectOption = { label: string; value: string };

export function FilterSelect({
  accessibilityLabel,
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  value: string;
}) {
  const { fonts, theme } = useMinionTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '-';

  return (
    <View style={styles.select}>
      <Text style={[styles.selectLabel, { color: theme.muted, ...fonts.medium }]}>{label}</Text>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? `${label} 선택`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={[styles.selectTrigger, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.selectValue, { color: theme.ink, ...fonts.medium }]}>{selectedLabel}</Text>
        <ChevronDown color={theme.muted} size={16} style={open ? styles.chevronOpen : null} />
      </Pressable>
      {open ? (
        <ScrollView
          accessibilityLabel={`${label} 선택 목록`}
          contentContainerStyle={styles.selectListContent}
          nestedScrollEnabled
          style={[styles.selectList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => {
                  setOpen(false);
                  if (option.value !== value) onChange(option.value);
                }}
                style={[styles.selectOption, selected && { backgroundColor: theme.ink }]}>
                <Text style={[styles.selectOptionText, { color: selected ? theme.surface : theme.ink, ...fonts.medium }]}>{option.label}</Text>
                {selected ? <Check color={theme.surface} size={15} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  select: { flex: 1, gap: 6, position: 'relative', zIndex: 20 },
  selectLabel: { fontSize: 13, lineHeight: 19.5 },
  selectList: {
    borderRadius: 12,
    borderWidth: 1,
    boxShadow: '0 18px 45px rgba(15,23,42,0.16)',
    elevation: 20,
    left: 0,
    marginTop: 6,
    maxHeight: 224,
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: 20,
  },
  selectListContent: { padding: 6 },
  selectOption: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  selectOptionText: { fontSize: 13, lineHeight: 19.5 },
  selectTrigger: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 40, justifyContent: 'space-between', paddingHorizontal: 12 },
  selectValue: { fontSize: 14, lineHeight: 21 },
});
