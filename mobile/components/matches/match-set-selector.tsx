import { View } from 'react-native';

import { FilterSelect } from '@/components/filter-select';
import type { MobileMatchSetSummary } from '@/lib/api-client';

/** 웹 모바일 주요 탭 오른쪽의 세트 드롭다운. */
export function MatchSetSelector({ activeSetId, onSelect, sets }: { activeSetId: string; onSelect: (setId: string) => void; sets: MobileMatchSetSummary[] }) {
  if (sets.length === 0) return null;

  return (
    <View style={{ width: 85, alignSelf: 'stretch' }}>
      <FilterSelect
        accessibilityLabel="세트 선택"
        compact
        matchTab
        label="세트"
        onChange={onSelect}
        options={sets.map((set) => ({ value: set.id, label: `${set.setNumber}세트` }))}
        value={activeSetId}
        variant="web"
      />
    </View>
  );
}
