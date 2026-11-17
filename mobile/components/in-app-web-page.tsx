import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewProps } from 'react-native-webview';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin, resolveApiAssetUrl } from '@/lib/api-client';

const POLICY_PATH = /^\/(?:about|terms|privacy|advertising|community\/rules)\/?$/;

type Props = { path: string; title: string };

export function InAppWebPage({ path, title }: Props) {
  const router = useRouter();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const webView = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const uri = resolveApiAssetUrl(path) ?? `${mobileApiOrigin}${path}`;
  const origin = useMemo(() => new URL(uri).origin, [uri]);
  const injectedJavaScript = useMemo(() => `
    (function() {
      function applyMinionAppStyle() {
        var root = document.documentElement;
        localStorage.setItem('minion-theme', '${colorScheme}');
        root.classList.toggle('dark', ${colorScheme === 'dark'});
        root.style.colorScheme = '${colorScheme}';
        ${Platform.OS === 'ios' ? `
        if (!document.getElementById('minion-ios-navigation')) {
          var style = document.createElement('style');
          style.id = 'minion-ios-navigation';
          style.textContent = 'nav a[href="/predictions"], aside a[href="/predictions"] { display: none !important; }';
          document.head.appendChild(style);
        }
        ` : ''}
      }
      applyMinionAppStyle();
      document.addEventListener('DOMContentLoaded', applyMinionAppStyle, { once: true });
      if (window.minionPolicyNavigationInstalled) return;
      window.minionPolicyNavigationInstalled = true;
      document.addEventListener('click', function(event) {
        var link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!link) return;
        var target = new URL(link.href, location.href);
        if (target.origin !== location.origin || ${POLICY_PATH}.test(target.pathname)) return;
        event.preventDefault();
        event.stopPropagation();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'navigate', url: target.href }));
      }, true);
    })();
    true;
  `, [colorScheme]);
  const onShouldStartLoadWithRequest = useCallback<NonNullable<WebViewProps['onShouldStartLoadWithRequest']>>((request) => {
    if (request.url.startsWith('mailto:') || request.url.startsWith('tel:')) {
      void Linking.openURL(request.url);
      return false;
    }
    try {
      const target = new URL(request.url);
      if (target.origin === origin) {
        if (POLICY_PATH.test(target.pathname)) return true;
        router.push(`${target.pathname}${target.search}${target.hash}` as never);
        return false;
      }
    } catch {
      return request.url === 'about:blank';
    }
    void Linking.openURL(request.url);
    return false;
  }, [origin, router]);

  return <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: theme.pageBackground }]}>
    <View style={styles.webViewWrap}>
      <WebView
        ref={webView}
        automaticallyAdjustContentInsets={false}
        allowsBackForwardNavigationGestures
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled
        onError={() => { setFailed(true); setLoading(false); }}
        onHttpError={() => { setFailed(true); setLoading(false); }}
        onLoadEnd={() => setLoading(false)}
        onLoadStart={() => { setFailed(false); setLoading(true); }}
        onMessage={event => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type !== 'navigate' || typeof message.url !== 'string') return;
            const target = new URL(message.url);
            if (target.origin === origin && !POLICY_PATH.test(target.pathname)) {
              router.push(`${target.pathname}${target.search}${target.hash}` as never);
            }
          } catch (error) {
            console.warn('Invalid policy page navigation', error);
          }
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        originWhitelist={['https://*', 'http://*', 'mailto:*', 'tel:*']}
        setSupportMultipleWindows={false}
        source={{ uri }}
        accessibilityLabel={title}
        contentInsetAdjustmentBehavior="never"
        style={[styles.webView, { backgroundColor: theme.pageBackground }]}
      />
      {loading ? <View pointerEvents="none" style={[styles.loading, { backgroundColor: theme.pageBackground }]}><ActivityIndicator accessibilityLabel="페이지 불러오는 중" color={theme.accent} size="small" /></View> : null}
      {failed ? <View style={[styles.error, { backgroundColor: theme.pageBackground }]}>
        <Text style={{ color: theme.text, ...fonts.medium, fontSize: 15, lineHeight: 22 }}>페이지를 불러오지 못했습니다.</Text>
        <Pressable accessibilityRole="button" onPress={() => webView.current?.reload()} style={[styles.retry, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={{ color: theme.text, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>다시 시도</Text>
        </Pressable>
      </View> : null}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webViewWrap: { flex: 1, position: 'relative' },
  webView: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
  retry: { borderRadius: 8, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
