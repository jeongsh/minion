import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { MobileBootstrapDto } from '../../packages/contracts/src/mobile-v1';
import { fetchMobileApi, mobileApiOrigin } from '@/lib/api-client';
import { getInstallationId, setAuthReturnTo, takeAuthReturnTo } from '@/lib/secure-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = 'google' | 'kakao' | 'apple' | 'naver';
type Viewer = NonNullable<MobileBootstrapDto['viewer']>;
type AuthResult = { error: string | null; message?: string };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  viewer: Viewer | null;
  refreshViewer: () => Promise<void>;
  signInWithEmail: (email: string, password: string, returnTo?: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, returnTo?: string) => Promise<AuthResult>;
  signInWithOAuth: (provider: OAuthProvider, returnTo?: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const callbackUrl = Linking.createURL('auth/callback', { scheme: 'minion' });

function messageForAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/email not confirmed/i.test(message)) return '이메일 인증을 먼저 완료해주세요.';
  if (/already registered/i.test(message)) return '이미 가입된 이메일입니다.';
  return message;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const handledUrls = useRef(new Set<string>());

  const refreshViewer = useCallback(async () => {
    try {
      const bootstrap = await fetchMobileApi<MobileBootstrapDto>('/api/mobile/v1/bootstrap');
      setViewer(bootstrap.viewer);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession && !bootstrap.viewer) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
      }
    } catch {
      setViewer(null);
    }
  }, []);

  const finishLogin = useCallback(async () => {
    await refreshViewer();
    const returnTo = await takeAuthReturnTo();
    router.replace(returnTo as never);
  }, [refreshViewer, router]);

  const handleCallback = useCallback(async (url: string) => {
    if (handledUrls.current.has(url)) return;
    handledUrls.current.add(url);
    const parsed = Linking.parse(url);
    const query = parsed.queryParams ?? {};
    const error = typeof query.error_description === 'string' ? query.error_description : typeof query.error === 'string' ? query.error : null;
    if (error) throw new Error(error);
    const code = typeof query.code === 'string' ? query.code : null;
    if (!code) return;
    if (query.provider === 'naver') {
      const installationId = await getInstallationId();
      const response = await fetch(`${mobileApiOrigin}/api/mobile/v1/auth/naver/exchange`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, installationId }),
      });
      const body = await response.json() as { data?: { accessToken: string; refreshToken: string }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? '네이버 세션 교환에 실패했습니다.');
      const { error: sessionError } = await supabase.auth.setSession({ access_token: body.data.accessToken, refresh_token: body.data.refreshToken });
      if (sessionError) throw sessionError;
    } else {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    }
    if (Platform.OS !== 'web') WebBrowser.dismissBrowser();
    await finishLogin();
  }, [finishLogin]);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    const auth = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setViewer(null);
    });
    const reportCallbackError = (error: unknown) => router.replace(`/login?error=${encodeURIComponent(error instanceof Error ? error.message : '로그인에 실패했습니다.')}` as never);
    const links = Linking.addEventListener('url', ({ url }) => { void handleCallback(url).catch(reportCallbackError); });
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refreshViewer();
      setLoading(false);
    });
    void Linking.getInitialURL().then((url) => { if (url?.includes('/auth/callback')) void handleCallback(url).catch(reportCallbackError); });
    return () => { appState.remove(); auth.data.subscription.unsubscribe(); links.remove(); };
  }, [handleCallback, refreshViewer, router]);

  const signInWithEmail = useCallback(async (email: string, password: string, returnTo = '/') => {
    await setAuthReturnTo(returnTo);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: messageForAuthError(error.message) };
    await finishLogin();
    return { error: null };
  }, [finishLogin]);

  const signUpWithEmail = useCallback(async (email: string, password: string, returnTo = '/me') => {
    await setAuthReturnTo(returnTo);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callbackUrl,
        data: { age_confirmed: true, terms_accepted: true, privacy_accepted: true, policy_version: '2026-08-01' },
      },
    });
    if (error) return { error: messageForAuthError(error.message) };
    if (!data.session) return { error: null, message: '가입 확인 메일을 보냈습니다. 메일에서 인증을 완료해주세요.' };
    await finishLogin();
    return { error: null };
  }, [finishLogin]);

  const signInWithOAuth = useCallback(async (provider: OAuthProvider, returnTo = '/') => {
    await setAuthReturnTo(returnTo);
    let authUrl: string;
    if (provider === 'naver') {
      const installationId = await getInstallationId();
      authUrl = `${mobileApiOrigin}/api/mobile/v1/auth/naver/start?redirect_to=${encodeURIComponent(callbackUrl)}&installation_id=${encodeURIComponent(installationId)}`;
    } else {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
      });
      if (error || !data.url) return { error: messageForAuthError(error?.message ?? '소셜 로그인을 시작할 수 없습니다.') };
      authUrl = data.url;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
    if (result.type === 'success') {
      try { await handleCallback(result.url); } catch (error) { return { error: error instanceof Error ? error.message : '로그인에 실패했습니다.' }; }
    }
    return { error: null };
  }, [handleCallback]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: messageForAuthError(error.message) };
    setViewer(null);
    router.replace('/');
    return { error: null };
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({ configured: isSupabaseConfigured, loading, refreshViewer, session, signInWithEmail, signInWithOAuth, signOut, signUpWithEmail, viewer }), [loading, refreshViewer, session, signInWithEmail, signInWithOAuth, signOut, signUpWithEmail, viewer]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
