import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScheduleDialogChrome } from '@/components/schedule/schedule-dialog-chrome';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePredictionBet } from '../../../packages/contracts/src/mobile-v1';
import { predictionMaxStake } from '@/lib/predictions';

export type PredictionBetDialogState = {
  existingBet: MobilePredictionBet | null;
  matchId: string;
  teamId: string;
  teamName: string;
};

type PredictionBetSheetProps = {
  balance: number;
  dialog: PredictionBetDialogState | null;
  error: string | null;
  onCancelBet: () => void;
  onClose: () => void;
  onStakeChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  stake: string;
};

export function PredictionBetSheet({ balance, dialog, error, onCancelBet, onClose, onStakeChange, onSubmit, pending, stake }: PredictionBetSheetProps) {
  const { fonts, theme } = useMinionTheme();
  const amount = Number(stake);
  const maxStake = predictionMaxStake(balance);
  const valid = Number.isSafeInteger(amount) && amount >= 100 && amount <= maxStake && amount <= balance;

  function setRatio(ratio: number) {
    onStakeChange(String(Math.max(100, Math.floor((maxStake * ratio) / 100) * 100)));
  }

  return (
    <ScheduleDialogChrome onClose={pending ? () => undefined : onClose} open={Boolean(dialog)} title="승부예측">
      {dialog ? (
        <View style={styles.content}>
          {dialog.existingBet ? (
            <View style={[styles.existing, { backgroundColor: theme.card }]}>
              <Text style={[styles.existingTitle, { color: theme.ink, fontFamily: fonts.bold }]}>이미 이 경기에 {dialog.existingBet.stake.toLocaleString('ko-KR')} LP를 사용했습니다.</Text>
              <Text style={[styles.help, { color: theme.muted, fontFamily: fonts.regular }]}>팀이나 금액을 바꾸려면 기존 예측을 취소한 뒤 다시 참여해 주세요.</Text>
              <Pressable disabled={pending} onPress={onCancelBet} style={({ pressed }) => [styles.cancelButton, { opacity: pending || pressed ? 0.65 : 1 }]}>
                {pending ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.primaryText, { fontFamily: fonts.black }]}>예측 취소하고 LP 환불</Text>}
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.ink, fontFamily: fonts.bold }]}>사용할 LP</Text>
                <Text style={[styles.limit, { color: theme.muted, fontFamily: fonts.medium }]}>1회 한도 {maxStake.toLocaleString('ko-KR')} LP</Text>
              </View>
              <View style={[styles.inputWrap, { borderColor: error ? '#ef4444' : theme.border }]}>
                <TextInput
                  accessibilityLabel="사용할 LP"
                  editable={!pending}
                  keyboardType="number-pad"
                  maxLength={7}
                  onChangeText={(value) => onStakeChange(value.replace(/[^0-9]/g, ''))}
                  selectTextOnFocus
                  style={[styles.input, { color: theme.ink, fontFamily: fonts.black }]}
                  value={stake}
                />
                <Text style={[styles.unit, { color: theme.muted, fontFamily: fonts.black }]}>LP</Text>
              </View>
              <View style={styles.ratios}>
                {[0.25, 0.5, 0.75, 1].map((ratio) => (
                  <Pressable disabled={pending} key={ratio} onPress={() => setRatio(ratio)} style={({ pressed }) => [styles.ratioButton, { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={[styles.ratioText, { color: theme.text, fontFamily: fonts.medium }]}>{ratio === 1 ? '최대' : `${ratio * 100}%`}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.help, { color: valid ? theme.muted : '#ef4444', fontFamily: fonts.medium }]}>
                {valid
                  ? `보유 ${balance.toLocaleString('ko-KR')} LP · 경기당 최대 20%, 상한 5,000 LP`
                  : `100 LP 이상 ${Math.min(maxStake, balance).toLocaleString('ko-KR')} LP 이하로 입력해 주세요.`}
              </Text>
              <Pressable disabled={!valid || pending} onPress={onSubmit} style={({ pressed }) => [styles.submitButton, { backgroundColor: theme.ink, opacity: !valid || pending ? 0.4 : pressed ? 0.8 : 1 }]}>
                {pending ? <ActivityIndicator color={theme.surface} /> : <Text style={[styles.submitText, { color: theme.surface, fontFamily: fonts.black }]}>{amount.toLocaleString('ko-KR')} LP로 확정</Text>}
              </Pressable>
            </>
          )}
          {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { fontFamily: fonts.medium }]}>{error}</Text> : null}
        </View>
      ) : null}
    </ScheduleDialogChrome>
  );
}

const styles = StyleSheet.create({
  cancelButton: { alignItems: 'center', backgroundColor: '#f05a47', borderRadius: 10, height: 46, justifyContent: 'center', marginTop: 16 },
  content: { gap: 12 },
  error: { color: '#ef4444', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  existing: { borderRadius: 12, padding: 16 },
  existingTitle: { fontSize: 13, lineHeight: 19.5 },
  help: { fontSize: 12, lineHeight: 18 },
  input: { flex: 1, fontSize: 18, height: 54, padding: 0 },
  inputWrap: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 56, paddingHorizontal: 16 },
  label: { fontSize: 13, lineHeight: 19.5 },
  labelRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  limit: { fontSize: 12, lineHeight: 18 },
  primaryText: { color: '#ffffff', fontSize: 13 },
  ratioButton: { alignItems: 'center', borderRadius: 8, flex: 1, height: 38, justifyContent: 'center' },
  ratioText: { fontSize: 12 },
  ratios: { flexDirection: 'row', gap: 8 },
  submitButton: { alignItems: 'center', borderRadius: 12, height: 50, justifyContent: 'center', marginTop: 2 },
  submitText: { fontSize: 13 },
  unit: { fontSize: 13 },
});
