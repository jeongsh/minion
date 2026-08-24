import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

type Mode = 'login' | 'signup';
const character = require('@/assets/characters/pen-4.png');

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string; next?: string }>();
  const insets = useSafeAreaInsets();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const { configured, signInWithEmail, signInWithOAuth, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consented, setConsented] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(typeof params.error === 'string' ? params.error : null);
  const returnTo = typeof params.next === 'string' && params.next.startsWith('/') ? params.next : mode === 'signup' ? '/me' : '/';
  const title = mode === 'login' ? '다시 만나 반가워요' : 'MINION 팬이 되어보세요';
  const description = mode === 'login' ? '승부예측, 커뮤니티와 내 LP 기록을 이어서 확인하세요.' : '하나의 계정으로 웹과 앱의 최애팀, LP와 활동을 함께 관리해요.';
  const formMuted = colorScheme === 'dark' ? '#8f98a8' : '#667085';

  const run = async (key: string, task: () => Promise<{ error: string | null; message?: string }>) => {
    if (pending) return;
    setPending(key); setError(null); setMessage(null);
    try {
      const result = await task();
      setError(result.error);
      setMessage(result.message ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '인증 처리 중 오류가 발생했습니다.');
    } finally { setPending(null); }
  };

  const submit = () => {
    if (!configured) return setError('앱의 Supabase 공개 설정이 필요합니다.');
    if (!email.trim() || password.length < 6) return setError('이메일과 6자 이상의 비밀번호를 입력해주세요.');
    if (mode === 'signup' && !consented) return setError('만 14세 이상 확인과 필수 약관에 동의해주세요.');
    void run('email', () => mode === 'login' ? signInWithEmail(email, password, returnTo) : signUpWithEmail(email, password, returnTo));
  };

  if (mode === 'login') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: theme.pageBackground }]}>
        <View style={[styles.header, { borderBottomColor: colorScheme === 'dark' ? '#343840' : '#e8e8eb', height: insets.top + 56, paddingTop: insets.top }]}>
          <Pressable accessibilityLabel="이전 화면" onPress={() => router.replace('/')} style={styles.headerBack}>
            <ChevronLeft color={theme.ink} size={22} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.ink, fontFamily: fonts.black }]}>로그인</Text>
          <View style={styles.headerSide} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.loginPage, { paddingBottom: insets.bottom + 16 }]}
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}>
          <View style={[styles.loginShell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.loginIntro}>
              <View style={styles.loginIntroCopy}>
                <Text style={[styles.loginBrand, { fontFamily: fonts.black }]}>MINION.</Text>
                <Text style={[styles.loginTitle, { fontFamily: fonts.display }]}>{title}</Text>
                <Text style={[styles.loginDescription, { fontFamily: fonts.bold }]}>{description}</Text>
              </View>
              <Image contentFit="contain" contentPosition="bottom" source={character} style={styles.loginCharacter} />
            </View>
            <View style={styles.loginFormWrap}>
              <View style={styles.emailForm}>
                <Field label="이메일">
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink, fontFamily: fonts.regular }]}
                    value={email}
                  />
                </Field>
                <Field label="비밀번호">
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    onChangeText={setPassword}
                    secureTextEntry
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.ink, fontFamily: fonts.regular }]}
                    value={password}
                  />
                </Field>
                {error ? <Text accessibilityRole="alert" style={styles.loginError}>{error}</Text> : null}
                {message ? <Text style={[styles.loginMessage, { color: theme.text, fontFamily: fonts.regular }]}>{message}</Text> : null}
                <Pressable disabled={Boolean(pending)} onPress={submit} style={[styles.loginPrimary, { opacity: pending ? 0.5 : 1 }]}>
                  {pending === 'email' ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.loginPrimaryText, { fontFamily: fonts.black }]}>로그인</Text>}
                </Pressable>
                <Text style={[styles.accountLinks, { color: formMuted, fontFamily: fonts.regular }]}>
                  계정이 없으신가요?{' '}
                  <Text onPress={() => router.replace(`/signup?next=${encodeURIComponent(returnTo)}` as never)} style={[styles.inlineLink, { color: theme.ink, fontFamily: fonts.bold }]}>회원가입</Text>
                  {' · '}
                  <Text onPress={() => void Linking.openURL(`${mobileApiOrigin}/forgot-password`)} style={[styles.inlineLink, { color: theme.ink, fontFamily: fonts.bold }]}>비밀번호 재설정</Text>
                </Text>
              </View>
              <View style={styles.loginDivider}>
                <View style={[styles.rule, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.muted, fontFamily: fonts.medium }]}>또는</Text>
                <View style={[styles.rule, { backgroundColor: theme.border }]} />
              </View>
              <View style={styles.socialList}>
                <SocialButton border={colorScheme === 'dark' ? '#8e918f' : '#747775'} compact disabled={Boolean(pending)} icon={<GoogleIcon />} label="구글로 계속하기" onPress={() => void run('google', () => signInWithOAuth('google', returnTo))} pending={pending === 'google'} text={colorScheme === 'dark' ? '#e3e3e3' : '#1f1f1f'} tone={colorScheme === 'dark' ? '#131314' : '#ffffff'} />
                <SocialButton compact disabled={Boolean(pending)} icon={<KakaoIcon />} label="카카오로 계속하기" onPress={() => void run('kakao', () => signInWithOAuth('kakao', returnTo))} pending={pending === 'kakao'} text="#191600" tone="#fee500" />
                <SocialButton compact disabled={Boolean(pending)} icon={<NaverIcon />} label="네이버로 계속하기" onPress={() => void run('naver', () => signInWithOAuth('naver', returnTo))} pending={pending === 'naver'} text="#ffffff" tone="#03c75a" />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: theme.pageBackground, flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24, paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}><ChevronLeft color={theme.ink} size={22} /></Pressable>
        <View style={[styles.shell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.intro}>
            <View style={styles.introCopy}><Text style={[styles.brand, { fontFamily: fonts.black }]}>MINION.</Text><Text style={[styles.title, { fontFamily: fonts.display }]}>{title}</Text><Text style={[styles.description, { fontFamily: fonts.bold }]}>{description}</Text></View>
            <Image contentFit="contain" contentPosition="bottom" source={character} style={styles.character} />
          </View>
          <View style={styles.form}>
            <Field label="이메일"><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="fan@minion.gg" placeholderTextColor={theme.muted} style={[styles.input, { borderColor: theme.border, color: theme.ink, fontFamily: fonts.regular }]} value={email} /></Field>
            <Field label="비밀번호"><TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} placeholder="6자 이상" placeholderTextColor={theme.muted} secureTextEntry style={[styles.input, { borderColor: theme.border, color: theme.ink, fontFamily: fonts.regular }]} value={password} /></Field>
            <Pressable onPress={() => setConsented((value) => !value)} style={[styles.consent, { backgroundColor: theme.surfaceMuted }]}><Switch onValueChange={setConsented} trackColor={{ false: theme.border, true: theme.accent }} value={consented} /><Text style={[styles.consentText, { color: theme.text, fontFamily: fonts.medium }]}>만 14세 이상이며 이용약관과 개인정보 처리방침에 동의합니다.</Text></Pressable>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {message ? <Text style={[styles.message, { color: theme.text }]}>{message}</Text> : null}
            <Pressable disabled={Boolean(pending)} onPress={submit} style={[styles.primary, { backgroundColor: theme.accent, opacity: pending ? 0.65 : 1 }]}>{pending === 'email' ? <ActivityIndicator color="#061018" /> : <Text style={[styles.primaryText, { fontFamily: fonts.bold }]}>회원가입</Text>}</Pressable>
            <Pressable onPress={() => router.replace(`/login?next=${encodeURIComponent(returnTo)}` as never)}><Text style={[styles.switchMode, { color: theme.muted, fontFamily: fonts.medium }]}>이미 계정이 있으신가요?  로그인</Text></Pressable>
            <View style={styles.or}><View style={[styles.rule, { backgroundColor: theme.border }]} /><Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>또는</Text><View style={[styles.rule, { backgroundColor: theme.border }]} /></View>
            <SocialButton disabled={Boolean(pending)} label="Google로 계속" onPress={() => void run('google', () => signInWithOAuth('google', returnTo))} pending={pending === 'google'} tone="#ffffff" text="#202124" border="#dadce0" />
            <SocialButton disabled={Boolean(pending)} label="Kakao로 계속" onPress={() => void run('kakao', () => signInWithOAuth('kakao', returnTo))} pending={pending === 'kakao'} tone="#fee500" text="#191919" />
            {Platform.OS === 'ios' ? <SocialButton disabled={Boolean(pending)} label="Apple로 계속" onPress={() => void run('apple', () => signInWithOAuth('apple', returnTo))} pending={pending === 'apple'} tone={colorScheme === 'dark' ? '#ffffff' : '#000000'} text={colorScheme === 'dark' ? '#000000' : '#ffffff'} /> : null}
            <SocialButton disabled={Boolean(pending)} label="Naver로 계속" onPress={() => void run('naver', () => signInWithOAuth('naver', returnTo))} pending={pending === 'naver'} tone="#03c75a" text="#ffffff" />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.field}><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 }}>{label}</Text>{children}</View>; }
function SocialButton({ border, compact = false, disabled, icon, label, onPress, pending, text, tone }: { border?: string; compact?: boolean; disabled: boolean; icon?: React.ReactNode; label: string; onPress: () => void; pending: boolean; text: string; tone: string }) { const { fonts } = useMinionTheme(); return <Pressable disabled={disabled} onPress={onPress} style={[styles.social, compact && styles.socialCompact, { backgroundColor: tone, borderColor: border ?? tone, opacity: disabled && !pending ? 0.5 : 1 }]}>{pending ? <ActivityIndicator color={text} /> : <View style={styles.socialContent}>{icon}<Text style={{ color: text, fontFamily: fonts.bold, fontSize: compact ? 13 : 14 }}>{label}</Text></View>}</Pressable>; }

function GoogleIcon() { return <Svg height={16} viewBox="0 0 18 18" width={16}><Path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62Z" fill="#4285F4" /><Path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" fill="#34A853" /><Path d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" fill="#FBBC05" /><Path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" fill="#EA4335" /></Svg>; }
function KakaoIcon() { return <Svg height={16} viewBox="0 0 18 18" width={16}><Path d="M9 2C4.58 2 1 4.77 1 8.2c0 2.19 1.47 4.11 3.68 5.22-.16.58-.6 2.16-.69 2.5-.11.42.15.42.32.3.13-.09 2.1-1.42 2.95-2 .89.13 1.8.2 2.74.2 4.42 0 8-2.77 8-6.22C18 4.77 14.42 2 9 2Z" fill="#191600" /></Svg>; }
function NaverIcon() { return <Svg height={12} viewBox="0 0 14 14" width={12}><Path d="M8.24 0v6.4L4.09 0H0v14h4.09V7.6L8.24 14H12.33V0H8.24Z" fill="#ffffff" /></Svg>; }

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 8 },
  headerBack: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerTitle: { flex: 1, fontSize: 16, textAlign: 'center' },
  headerSide: { height: 44, width: 44 },
  loginPage: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: 16 },
  loginShell: { borderRadius: 16, borderWidth: 1, boxShadow: '0 20px 55px rgba(24,25,28,0.10)', maxWidth: 512, overflow: 'hidden', width: '100%' },
  loginIntro: { backgroundColor: '#00b85c', flexDirection: 'row', gap: 10, minHeight: 140, paddingHorizontal: 20, paddingVertical: 20 },
  loginIntroCopy: { flex: 1, minWidth: 0 },
  loginBrand: { color: '#ffe45c', fontSize: 13, letterSpacing: -0.39 },
  loginTitle: { color: '#ffffff', fontSize: 22, letterSpacing: -0.88, lineHeight: 28, marginTop: 8 },
  loginDescription: { color: 'rgba(255,255,255,0.80)', fontSize: 14, lineHeight: 24, marginTop: 8 },
  loginCharacter: { alignSelf: 'flex-end', height: 92, width: 112 },
  loginFormWrap: { gap: 20, padding: 24 },
  emailForm: { gap: 16 },
  loginPrimary: { alignItems: 'center', backgroundColor: '#00b85c', borderRadius: 12, justifyContent: 'center', minHeight: 48 },
  loginPrimaryText: { color: '#ffffff', fontSize: 14 },
  loginError: { color: '#dc2626', fontSize: 14, lineHeight: 20 },
  loginMessage: { fontSize: 14, lineHeight: 20 },
  accountLinks: { fontSize: 14, lineHeight: 20 },
  inlineLink: { textDecorationLine: 'underline' },
  loginDivider: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  dividerText: { fontSize: 12, lineHeight: 18 },
  socialList: { gap: 8 },
  socialContent: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  socialCompact: { borderRadius: 12, minHeight: 48 },
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16 }, back: { alignItems: 'center', height: 44, justifyContent: 'center', marginBottom: 8, width: 44 }, shell: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, intro: { backgroundColor: '#8ed646', flexDirection: 'row', minHeight: 140, overflow: 'hidden', paddingLeft: 20, paddingTop: 20 }, introCopy: { flex: 1, zIndex: 1 }, brand: { color: '#234017', fontSize: 13 }, title: { color: '#ffffff', fontSize: 22, lineHeight: 28, marginTop: 8 }, description: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: 235 }, character: { alignSelf: 'flex-end', height: 104, width: 108 }, form: { gap: 14, padding: 24 }, field: { gap: 6 }, input: { borderRadius: 12, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 14 }, consent: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, padding: 10 }, consentText: { flex: 1, fontSize: 12, lineHeight: 18 }, error: { color: '#dc2626', fontSize: 13, lineHeight: 19 }, message: { fontSize: 13, lineHeight: 19 }, primary: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 48 }, primaryText: { color: '#061018', fontSize: 14 }, switchMode: { fontSize: 13, textAlign: 'center' }, or: { alignItems: 'center', flexDirection: 'row', gap: 12 }, rule: { flex: 1, height: 1 }, social: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 46 },
});
