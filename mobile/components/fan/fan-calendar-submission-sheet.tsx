import { useRouter } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { FilterSelect } from '@/components/filter-select';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi, type MobileFanCalendarSubmissionDto, type MobileTeamSummary } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const TYPE_OPTIONS = [
  { label: '일정·이벤트', value: 'custom' },
  { label: '데뷔 기념일', value: 'debut' },
  { label: '우승 기념일', value: 'championship' },
] as const;

export function FanCalendarSubmissionSheet({ onClose, open, team }: { onClose: () => void; open: boolean; team: MobileTeamSummary }) {
  const router = useRouter();
  const { session } = useAuth();
  const { fonts, showToast, theme } = useMinionTheme();
  const [eventType, setEventType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('custom');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = `/fan/${team.fanSiteHost}/schedule`;

  const reset = () => {
    setEventType('custom');
    setTitle('');
    setEventDate('');
    setEventTime('');
    setIsRecurring(false);
    setDescription('');
    setSourceUrl('');
    setError(null);
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await mutateMobileApi<MobileFanCalendarSubmissionDto>(
        `/api/mobile/v1/teams/${encodeURIComponent(team.fanSiteHost)}/calendar-submissions`,
        'POST',
        { description, eventDate, eventTime, eventType, isRecurring, sourceUrl, teamId: team.id, title },
      );
      reset();
      onClose();
      showToast(result.message, 'success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '일정 제보를 접수하지 못했어요.');
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet maxHeight="92%" onClose={onClose} open={open} scrollable title={`${team.shortName} 일정 제보`}>
      {!session ? (
        <View style={styles.loginBody}>
          <Text style={[styles.loginText, { color: theme.text, ...fonts.regular }]}>로그인 후 일정을 제보할 수 있습니다.</Text>
          <Pressable onPress={() => { onClose(); router.navigate(`/login?returnTo=${encodeURIComponent(returnTo)}` as never); }} style={[styles.primary, { backgroundColor: theme.ink }]}><Text style={[styles.primaryText, { color: theme.surface, ...fonts.medium }]}>로그인하고 제보하기</Text></Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <FilterSelect
            accessibilityLabel="일정 종류 선택"
            label="일정 종류"
            onChange={(value) => setEventType(value as (typeof TYPE_OPTIONS)[number]['value'])}
            options={[...TYPE_OPTIONS]}
            value={eventType}
          />
          <FormInput label="일정 제목" maxLength={80} onChangeText={setTitle} placeholder="예: 팬 사인회, 창단 기념일" value={title} />
          <View style={styles.twoColumns}><View style={styles.column}><FormInput label="날짜" maxLength={10} onChangeText={setEventDate} placeholder="YYYY-MM-DD" value={eventDate} /></View><View style={styles.column}><FormInput label="시간 (선택)" maxLength={5} onChangeText={setEventTime} placeholder="HH:MM" value={eventTime} /></View></View>
          <Pressable onPress={() => setIsRecurring((value) => !value)} style={[styles.repeat, { borderColor: theme.border }]}><View style={[styles.checkbox, { backgroundColor: isRecurring ? theme.ink : theme.surface, borderColor: isRecurring ? theme.ink : theme.border }]}>{isRecurring ? <Check color={theme.surface} size={13} strokeWidth={2.5} /> : null}</View><Text style={[styles.repeatText, { color: theme.text, ...fonts.medium }]}>매년 반복</Text></Pressable>
          <FormInput label={`상세 설명 (선택)  ${description.length}/500`} maxLength={500} multiline onChangeText={setDescription} placeholder="운영진이 확인할 수 있도록 일정 내용을 적어주세요." value={description} />
          <FormInput autoCapitalize="none" label="출처 URL" maxLength={500} onChangeText={setSourceUrl} placeholder="https:// 공식 공지 또는 공개 게시물" value={sourceUrl} />
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: '#dc2626', ...fonts.regular }]}>{error}</Text> : null}
          <Pressable disabled={pending} onPress={() => void submit()} style={[styles.primary, { backgroundColor: theme.ink, opacity: pending ? 0.6 : 1 }]}>{pending ? <ActivityIndicator color={theme.surface} size="small" /> : null}<Text style={[styles.primaryText, { color: theme.surface, ...fonts.medium }]}>{pending ? '접수하는 중…' : '제보하기'}</Text></Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

function FieldLabel({ label }: { label: string }) {
  const { fonts, theme } = useMinionTheme();
  return <Text style={[styles.label, { color: theme.text, ...fonts.medium }]}>{label}</Text>;
}

function FormInput({ label, multiline = false, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.field}><FieldLabel label={label} /><TextInput {...props} editable={props.editable} multiline={multiline} placeholderTextColor={theme.muted} style={[styles.input, multiline && styles.multiline, { borderColor: theme.border, color: theme.ink, ...fonts.regular }]} textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}

const styles = StyleSheet.create({
  checkbox: { alignItems: 'center', borderRadius: 4, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 },
  column: { flex: 1, minWidth: 0 },
  error: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: 14, lineHeight: 21, paddingHorizontal: 12, paddingVertical: 8 },
  field: { gap: 6 },
  form: { gap: 12, paddingBottom: 8 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 14, height: 40, paddingHorizontal: 12, paddingVertical: 0 },
  label: { fontSize: 14, lineHeight: 20 },
  loginBody: { gap: 12, paddingBottom: 8 },
  loginText: { fontSize: 14, lineHeight: 21 },
  multiline: { height: 64, paddingTop: 8 },
  primary: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 40, justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontSize: 14, lineHeight: 20 },
  repeat: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, height: 40, paddingHorizontal: 12 },
  repeatText: { fontSize: 14, lineHeight: 20 },
  twoColumns: { flexDirection: 'row', gap: 12 },
});
