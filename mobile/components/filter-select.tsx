import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { minionSize } from '@/constants/minion-theme';

export type FilterSelectOption = { label: string; value: string };

export function FilterSelect({
  accessibilityLabel,
  compact = false,
  disabled,
  label,
  onChange,
  options,
  value,
  variant = 'default',
  matchTab = false,
}: {
  accessibilityLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  value: string;
  variant?: 'default' | 'web';
  matchTab?: boolean;
}) {
  const { fonts, theme } = useMinionTheme();
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const web = variant === 'web';
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '-';

  return (
    <View style={[styles.select, open && styles.selectOpen]}>
      {!compact ? <Text style={[styles.selectLabel, web && { fontSize: 14, lineHeight: 20 }, { color: theme.muted, ...fonts.medium }]}>{label}</Text> : null}
      <Pressable
        accessibilityLabel={accessibilityLabel ?? `${label} 선택`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={[styles.selectTrigger, compact && styles.compactTrigger, { backgroundColor: compact || web ? theme.surface : theme.card, borderColor: theme.border }, web && { borderRadius: 8 }, matchTab && { backgroundColor: theme.card, borderColor: theme.card, paddingHorizontal: 12 }]}>
        <Text numberOfLines={1} style={[styles.selectValue, web && { lineHeight: 20 }, { color: theme.ink, ...fonts.medium }]}>{selectedLabel}</Text>
        <ChevronDown color={theme.muted} size={web ? 20 : 16} strokeWidth={web ? 2.5 : 2} style={open ? styles.chevronOpen : null} />
      </Pressable>
      {open ? (
        <ScrollView
          accessibilityLabel={`${label} 선택 목록`}
          contentContainerStyle={styles.selectListContent}
          nestedScrollEnabled
          style={[styles.selectList, { backgroundColor: theme.surface, borderColor: theme.border }, web && { marginTop: 8, minWidth: 176, maxHeight: Math.min(height * 0.7, 448) }, matchTab && { minWidth: 0 }]}>
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
                style={[styles.selectOption, selected && { backgroundColor: web ? theme.surfaceMuted : theme.ink }, web && { paddingVertical: 10 }, matchTab && { paddingHorizontal: 4 }]}>
                <Text style={[styles.selectOptionText, web && { fontSize: 14, lineHeight: 20 }, { color: selected && !web ? theme.surface : theme.ink, ...fonts.medium }]}>{option.label}</Text>
                {selected ? <Check color={web ? theme.ink : theme.surface} size={web ? 16 : 15} strokeWidth={web ? 3 : 2} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactTrigger: { borderRadius: 6, paddingHorizontal: 8 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  select: { flex: 1, gap: 6, position: 'relative' },
  selectOpen: { zIndex: 30 },
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
  selectTrigger: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: minionSize.control, justifyContent: 'space-between', paddingHorizontal: 12 },
  selectValue: { flexShrink: 1, fontSize: 14, lineHeight: 21 },
});
