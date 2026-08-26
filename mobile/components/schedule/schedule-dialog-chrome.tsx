import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';

/** 일정 계열의 긴 콘텐츠도 공용 말머리 시트 크롬을 그대로 사용한다. */
export function ScheduleDialogChrome({ children, onClose, open, title }: PropsWithChildren<{ onClose: () => void; open: boolean; title: string }>) {
  return <BottomSheet contentStyle={styles.body} maxHeight="92%" onClose={onClose} open={open} scrollable title={title}>{children}</BottomSheet>;
}

const styles = StyleSheet.create({
  body: { padding: 16 },
});
