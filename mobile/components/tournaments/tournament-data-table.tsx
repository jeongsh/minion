import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

export type TournamentTableColumn<T> = { key: string; label: string; width: number; flex?: boolean; align?: 'left' | 'center'; render: (row: T) => ReactNode };

export function TournamentDataTable<T>({ columns, rows, onPressRow }: { columns: TournamentTableColumn<T>[]; rows: T[]; onPressRow?: (row: T) => void }) {
  const { fonts, theme } = useMinionTheme();
  const [width, setWidth] = useState(0);
  const minWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const tableWidth = Math.max(width, minWidth);
  const flexibleColumns = columns.filter(column => column.flex).length;
  const cellWidth = (column: TournamentTableColumn<T>) => column.width + (column.flex ? (tableWidth - minWidth) / flexibleColumns : 0);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.root}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: tableWidth }}>
        <View style={[styles.header, { backgroundColor: theme.surfaceMuted }]}>{columns.map(column => <View key={column.key} style={[styles.cell, { width: cellWidth(column) }]}><Text style={[styles.headerText, { color: theme.muted, textAlign: column.align ?? 'left', ...fonts.medium }]}>{column.label}</Text></View>)}</View>
        {rows.map((row, index) => {
          const cells = columns.map(column => <View key={column.key} style={[styles.cell, { width: cellWidth(column) }, column.align === 'center' && styles.center]}>{column.render(row)}</View>);
          const style = [styles.row, { backgroundColor: theme.surface }, index > 0 && { borderTopWidth: 1, borderTopColor: theme.divider }];
          return onPressRow ? <Pressable key={index} onPress={() => onPressRow(row)} style={style}>{cells}</Pressable> : <View key={index} style={style}>{cells}</View>;
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
