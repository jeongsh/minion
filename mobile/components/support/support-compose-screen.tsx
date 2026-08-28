import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileSupportInquiryMutationDto } from '@/lib/api-client';
import { invalidateApiCache, mutateMobileApi } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const SUBJECT_MAX = 100;
const MESSAGE_MAX = 2000;
const PASSWORD_MIN = 4;

export function SupportComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fonts, showToast, theme } = useMinionTheme();
  const { session } = useAuth();
  const isGuest = !session;
  const [contactEmail, setContactEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 로그인 작성자는 비공개 글을 볼 때 계정만으로 자동 통과하니 비밀번호 자체를 받지
  // 않는다(선택도 아님). 비회원은 계정이 없어 비밀번호가 유일한 잠금 수단이라 필수다.
  const showPasswordFields = isPrivate && isGuest;
  const passwordMismatch = showPasswordFields && password.length > 0 && password !== passwordConfirm;
  const passwordTooShort = showPasswordFields && password.length > 0 && password.length < PASSWORD_MIN;
  const emailMissing = isGuest && !contactEmail.trim();
  const passwordInvalid = showPasswordFields && (!password || passwordTooShort || passwordMismatch);
  const canSubmit = subject.trim() && message.trim() && !emailMissing && !passwordInvalid;
  const close = () => router.replace('/support' as never);

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await mutateMobileApi<MobileSupportInquiryMutationDto>('/api/mobile/v1/support/inquiries', 'POST', {
        contactEmail,
        isPrivate,
        message,
        password,
        subject,
      });
      await invalidateApiCache('/api/mobile/v1/support/inquiries');
      showToast(result.message, 'success');
      router.replace(`/support/${result.id}` as never);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : '문의 접수에 실패했어요.';
      setError(text);
      showToast(text, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareView style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />
      <View style={[styles.header, { borderBottomColor: theme.divider, marginTop: insets.top }]}>
        <Pressable accessibilityLabel="이전 화면" onPress={close} style={styles.headerButton}><ChevronLeft color={theme.text} size={22} /></Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink, ...fonts.display }]}>문의하기</Text>
        <Pressable
          accessibilityLabel={submitting ? '접수 중' : '접수하기'}
          disabled={submitting || !canSubmit}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.headerSubmit, { backgroundColor: theme.accent, opacity: submitting || !canSubmit ? 0.4 : pressed ? 0.78 : 1 }]}
        >
          {submitting ? <ActivityIndicator color={theme.accentForeground} size="small" /> : <Text style={{ color: theme.accentForeground, ...fonts.medium, fontSize: 14 }}>접수</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Field label="연락 이메일" hint={isGuest ? undefined : '(선택)'} theme={theme} fonts={fonts}>
          <TextInput
            accessibilityLabel="연락 이메일"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setContactEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.muted}
            style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text, ...fonts.regular }]}
            value={contactEmail}
          />
          <Text style={[styles.helper, { color: theme.muted, ...fonts.regular }]}>
            {isGuest ? '비회원은 문의를 다시 찾을 수 있도록 이메일이 꼭 필요해요.' : '게시판 글의 답변으로 확인할 수 있어요.'}
          </Text>
        </Field>

        <Field label="제목" theme={theme} fonts={fonts}>
          <TextInput
            accessibilityLabel="제목"
            maxLength={SUBJECT_MAX}
            onChangeText={setSubject}
            placeholder="문의 제목을 입력해주세요."
            placeholderTextColor={theme.muted}
            style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text, ...fonts.regular }]}
            value={subject}
          />
        </Field>

        <Field label="내용" theme={theme} fonts={fonts}>
          <TextInput
            accessibilityLabel="내용"
            maxLength={MESSAGE_MAX}
            multiline
            onChangeText={setMessage}
            placeholder="문의 유형(버그 신고, 계정 문의, 신고 처리 결과, 기타 등)과 문제가 발생한 페이지, 구체적인 상황을 알려주시면 빠르게 확인할 수 있어요."
            placeholderTextColor={theme.muted}
            style={[styles.textarea, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text, ...fonts.regular }]}
            value={message}
          />
          <Text style={[styles.counter, { color: theme.muted, ...fonts.regular }]}>{message.length.toLocaleString('ko-KR')}/{MESSAGE_MAX.toLocaleString('ko-KR')}자</Text>
        </Field>

        <View style={[styles.privacyBox, { backgroundColor: theme.surfaceMuted }]}>
          <View style={styles.privacyRow}>
            <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 13 }}>비공개로 작성 (비밀번호로만 열람)</Text>
            <Switch
              onValueChange={(value) => {
                setIsPrivate(value);
                if (!value) {
                  setPassword('');
                  setPasswordConfirm('');
                }
              }}
              thumbColor={theme.surface}
              trackColor={{ false: theme.border, true: theme.accent }}
              value={isPrivate}
            />
          </View>
          <Text style={[styles.helper, { color: theme.muted, ...fonts.regular }]}>
            {isGuest
              ? '켜면 비밀번호를 아는 사람만 내용을 볼 수 있어요. 켜지 않으면 누구나 게시판에서 제목과 내용을 볼 수 있어요.'
              : '켜면 로그인한 본인 계정으로만 볼 수 있어요(비밀번호 없이 자동으로 확인돼요). 켜지 않으면 누구나 게시판에서 제목과 내용을 볼 수 있어요.'}
          </Text>

          {showPasswordFields ? (
            <View style={styles.passwordRow}>
              <TextInput
                accessibilityLabel="비밀번호"
                maxLength={32}
                onChangeText={setPassword}
                placeholder="4자 이상"
                placeholderTextColor={theme.muted}
                secureTextEntry
                style={[styles.input, styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, ...fonts.regular }]}
                value={password}
              />
              <TextInput
                accessibilityLabel="비밀번호 확인"
                maxLength={32}
                onChangeText={setPasswordConfirm}
                placeholder="다시 입력"
                placeholderTextColor={theme.muted}
                secureTextEntry
                style={[styles.input, styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, ...fonts.regular }]}
                value={passwordConfirm}
              />
            </View>
          ) : null}
          {passwordTooShort ? <Text style={styles.error}>비밀번호는 4자 이상이어야 해요.</Text> : null}
          {passwordMismatch ? <Text style={styles.error}>비밀번호가 서로 달라요.</Text> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAwareView>
  );
}

function Field({
  children,
  fonts,
  hint,
  label,
  theme,
}: {
  children: React.ReactNode;
  fonts: ReturnType<typeof useMinionTheme>['fonts'];
  hint?: string;
  label: string;
  theme: ReturnType<typeof useMinionTheme>['theme'];
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.ink, ...fonts.bold }]}>
        {label}{hint ? <Text style={{ color: theme.muted, ...fonts.regular }}> {hint}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 32, paddingHorizontal: 16, paddingTop: 16 },
  counter: { alignSelf: 'flex-end', fontSize: 12 },
  error: { color: '#ef4444', fontSize: 13 },
  field: { gap: 6 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 48, paddingHorizontal: 12, position: 'relative' },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerSubmit: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', minWidth: 58, paddingHorizontal: 12, position: 'absolute', right: 12 },
  headerTitle: { fontSize: 16, left: 56, lineHeight: 24, position: 'absolute', right: 56, textAlign: 'center' },
  helper: { fontSize: 12 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 14, height: 44, paddingHorizontal: 12 },
  label: { fontSize: 13 },
  passwordInput: { flex: 1 },
  passwordRow: { flexDirection: 'row', gap: 8 },
  privacyBox: { borderRadius: 12, gap: 10, padding: 14 },
  privacyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  root: { flex: 1 },
  safeTop: { left: 0, position: 'absolute', right: 0, top: 0 },
  textarea: { borderRadius: 8, borderWidth: 1, fontSize: 14, lineHeight: 20, minHeight: 140, paddingHorizontal: 12, paddingTop: 10, textAlignVertical: 'top' },
});
