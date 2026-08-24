import { Image } from 'expo-image';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { ScheduleDialogChrome } from '@/components/schedule/schedule-dialog-chrome';
import { SCHEDULE_SEGMENTS, type ScheduleSegmentKey } from '@/constants/schedule-segments';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamSummary } from '@/lib/api-client';
import { gridAutoFill } from '@/lib/grid-auto-fill';
import { currentKSTMonthYear } from '@/lib/schedule-dates';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export type ScheduleFilterState = {
  segment: ScheduleSegmentKey | 'all';
  teamId: string;
  month: number;
  year: number;
};

export function ScheduleFilterSheet({
  filter,
  onApply,
  onClose,
  open,
  teams,
  years,
}: {
  filter: ScheduleFilterState;
  onApply: (next: ScheduleFilterState) => void;
  onClose: () => void;
  open: boolean;
  teams: MobileTeamSummary[];
  years: number[];
}) {
  const { fonts, theme } = useMinionTheme();
  const { width: windowWidth } = useWindowDimensions();
  const teamOptions = teams.filter((team) => team.isLckTeam !== false);
  // 다이얼로그 본문 padding(16px 양쪽) 뺀 실제 그리드 폭. 웹의 auto-fill 그리드와 동일한 공식을 씀.
  const gridWidth = windowWidth - 32;
  const segmentGrid = gridAutoFill(gridWidth, 46, 8);
  const teamGrid = gridAutoFill(gridWidth, 44, 8);

  function choose(patch: Partial<ScheduleFilterState>) {
    onApply({ ...filter, ...patch });
    onClose();
  }

  return (
    <ScheduleDialogChrome onClose={onClose} open={open} title="일정 필터">
      <View style={styles.yearMonthRow}>
        <FilterSelect
          disabled={!open}
          label="연도"
          onChange={(value) => onApply({ ...filter, year: Number(value) })}
          options={years.map((year) => ({ label: String(year), value: String(year) }))}
          value={String(filter.year)}
        />
        <FilterSelect
          disabled={!open}
          label="월"
          onChange={(value) => onApply({ ...filter, month: Number(value) })}
          options={MONTHS.map((month) => ({ label: `${month}월`, value: String(month) }))}
          value={String(filter.month)}
        />
      </View>

      <FilterGroup title="대회">
        <View style={styles.grid}>
          {SCHEDULE_SEGMENTS.map((segment) =>
            segment.key === 'all' ? (
              <PlainFilterChip active={filter.segment === 'all'} key={segment.key} label="전체" onPress={() => choose({ segment: 'all' })} width={segmentGrid.itemWidth} />
            ) : (
              <IconFilterChip
                active={filter.segment === segment.key}
                aspect={segment.logoAspect ?? 1.4}
                key={segment.key}
                logo={segment.logo}
                onPress={() => choose({ segment: segment.key as ScheduleSegmentKey })}
                width={segmentGrid.itemWidth}
              />
            ),
          )}
        </View>
      </FilterGroup>

      <FilterGroup title="팀">
        <View style={styles.grid}>
          <PlainFilterChip active={filter.teamId === 'all'} label="전체" onPress={() => choose({ teamId: 'all' })} width={teamGrid.itemWidth} />
          {teamOptions.map((team) => (
            <TeamFilterChip active={filter.teamId === team.id} key={team.id} onPress={() => choose({ teamId: team.id })} team={team} width={teamGrid.itemWidth} />
          ))}
        </View>
      </FilterGroup>

      <Pressable
        onPress={() => {
          const defaults = currentKSTMonthYear();
          onApply({ month: defaults.month, segment: 'all', teamId: 'all', year: defaults.year });
          onClose();
        }}
        style={[styles.resetButton, { backgroundColor: theme.ink }]}>
        <Text style={[styles.resetButtonText, { color: theme.surface, fontFamily: fonts.medium }]}>필터 초기화</Text>
      </Pressable>
    </ScheduleDialogChrome>
  );
}

function FilterGroup({ children, title }: { children: ReactNode; title: string }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterGroupTitle, { color: theme.muted, fontFamily: fonts.bold }]}>{title}</Text>
      {children}
    </View>
  );
}

function PlainFilterChip({ active, label, onPress, width }: { active: boolean; label: string; onPress: () => void; width: number }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.plainChip,
        { width },
        active ? { backgroundColor: theme.ink, borderColor: theme.ink } : { backgroundColor: theme.card, borderColor: theme.border },
      ]}>
      <Text style={[styles.plainChipText, { color: active ? theme.surface : theme.ink, fontFamily: fonts.medium }]}>{label}</Text>
    </Pressable>
  );
}

function IconFilterChip({ active, aspect, logo, onPress, width }: { active: boolean; aspect: number; logo?: number; onPress: () => void; width: number }) {
  const { theme } = useMinionTheme();
  const iconWidth = Math.min(34, 20 * aspect);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.iconChip, { width }, active ? { backgroundColor: theme.ink, borderColor: theme.ink } : { backgroundColor: theme.card, borderColor: theme.border }]}>
      {logo ? <Image contentFit="contain" source={logo} style={{ height: 20, width: iconWidth }} tintColor={active ? theme.surface : theme.muted} /> : null}
    </Pressable>
  );
}

function TeamFilterChip({ active, onPress, team, width }: { active: boolean; onPress: () => void; team: MobileTeamSummary; width: number }) {
  const { theme } = useMinionTheme();

  return (
    <Pressable
      accessibilityLabel={team.shortName || team.name}
      onPress={onPress}
      style={[styles.iconChip, { width }, active ? { backgroundColor: theme.ink, borderColor: theme.ink } : { backgroundColor: theme.card, borderColor: theme.border }]}>
      {active && team.logoDark?.url ? (
        <Image contentFit="contain" source={{ uri: resolveApiAssetUrl(team.logoDark.url) ?? undefined }} style={styles.teamChipLogo} />
      ) : (
        <TeamLogo plain size={28} team={team} themeAware />
      )}
    </Pressable>
  );
}

function FilterSelect({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const { fonts, theme } = useMinionTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '-';

  return (
    <View style={styles.select}>
      <Text style={[styles.selectLabel, { color: theme.muted, fontFamily: fonts.bold }]}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={[styles.selectTrigger, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.selectValue, { color: theme.ink, fontFamily: fonts.bold }]}>{selectedLabel}</Text>
        <ChevronDown color={theme.muted} size={16} />
      </Pressable>
      {open ? (
        <ScrollView
          contentContainerStyle={styles.selectListContent}
          nestedScrollEnabled
          style={[styles.selectList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setOpen(false);
                  if (option.value !== value) onChange(option.value);
                }}
                style={[styles.selectOption, selected && { backgroundColor: theme.ink }]}>
                <Text style={[styles.selectOptionText, { color: selected ? theme.surface : theme.ink, fontFamily: selected ? fonts.bold : fonts.medium }]}>{option.label}</Text>
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
  filterGroup: { marginTop: 16 },
  filterGroupTitle: { fontSize: 13, lineHeight: 19.5, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 40, justifyContent: 'center' },
  plainChip: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 40, justifyContent: 'center', paddingHorizontal: 8 },
  plainChipText: { fontSize: 12, lineHeight: 15, textAlign: 'center' },
  resetButton: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', marginTop: 16, minHeight: 40, paddingHorizontal: 12 },
  resetButtonText: { fontSize: 12, lineHeight: 18 },
  select: { flex: 1, gap: 6 },
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
  selectListContent: {
    padding: 6,
  },
  selectOption: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  selectOptionText: { fontSize: 13, lineHeight: 19.5 },
  selectTrigger: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 40, justifyContent: 'space-between', paddingHorizontal: 12 },
  selectValue: { fontSize: 14, lineHeight: 21 },
  teamChipLogo: { height: 28, width: 28 },
  yearMonthRow: { flexDirection: 'row', gap: 8 },
});
