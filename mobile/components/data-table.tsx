import type { ReactNode } from 'react';
import { useState } from 'react';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export type DataTableColumn<T> = { key: string; label: string; width: number; flex?: boolean; align?: 'left' | 'center' | 'right'; render: (row: T) => ReactNode };

export function DataTable<T>({ columns, rows, onPressRow, renderExpanded, rowLabel, getRowKey }: { columns: DataTableColumn<T>[]; rows: T[]; onPressRow?: (row: T) => void; renderExpanded?: (row: T) => ReactNode; rowLabel?: (row: T) => string; getRowKey?: (row: T, index: number) => string }) {
  const { fonts, theme } = useMinionTheme();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [width, setWidth] = useState(0);
  const minWidth = columns.reduce((sum, column) => sum + column.width, 0) + (renderExpanded ? 44 : 0);
  const tableWidth = Math.max(width, minWidth);
  const flexibleColumns = columns.filter(column => column.flex).length;
  const cellWidth = (column: DataTableColumn<T>) => column.width + (column.flex ? (tableWidth - minWidth) / flexibleColumns : 0);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.root}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: tableWidth }}>
        <View style={[styles.header, { backgroundColor: theme.surfaceMuted }]}>{columns.map(column => <View key={column.key} style={[styles.cell, { width: cellWidth(column) }]}><Text style={[styles.headerText, { color: theme.muted, textAlign: column.align ?? 'left', ...fonts.medium }]}>{column.label}</Text></View>)}{renderExpanded ? <View style={{ width: 44 }} /> : null}</View>
        {rows.map((row, index) => {
          const key = getRowKey?.(row, index) ?? String(index);
          const isExpanded = expanded.has(key);
          const cells = columns.map(column => <View key={column.key} style={[styles.cell, { width: cellWidth(column) }, column.align === 'center' ? styles.center : column.align === 'right' ? { alignItems: 'flex-end' } : undefined]}>{column.render(row)}</View>);
          const style = [styles.row, { backgroundColor: theme.surface }, index > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }];
          return <View key={key}>{onPressRow || renderExpanded ? <Pressable accessibilityRole={renderExpanded ? 'button' : 'link'} accessibilityLabel={rowLabel?.(row)} accessibilityState={renderExpanded ? { expanded: isExpanded } : undefined} onPress={() => renderExpanded ? setExpanded((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }) : onPressRow?.(row)} style={style}>{cells}{renderExpanded ? <View style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={18} color={theme.muted} style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} /></View> : null}</Pressable> : <View style={style}>{cells}</View>}{renderExpanded && isExpanded ? renderExpanded(row) : null}</View>;
        })}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  cell: { justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  center: { alignItems: 'center' },
  header: { flexDirection: 'row', height: 40 },
  headerText: { fontSize: 14, lineHeight: 20 },
  root: { minWidth: 0, width: '100%' },
  row: { flexDirection: 'row', minHeight: 48 },
});
