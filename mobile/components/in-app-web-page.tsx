import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewProps } from 'react-native-webview';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mobileApiOrigin, resolveApiAssetUrl } from '@/lib/api-client';

const HIDE_SITE_CHROME = `
  [data-app-shell] > header { display: none !important; }
  [data-app-shell] > .ad-rail-layout { padding-top: 0 !important; }
  [data-app-shell] footer,
  [data-app-shell] nav[aria-label="모바일 주요 메뉴"],
  [data-app-shell] .layout-wide > header { display: none !important; }
`;

type Props = { path: string; title: string };

export function InAppWebPage({ path, title }: Props) {
  const router = useRouter();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const webView = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);
  const uri = resolveApiAssetUrl(path) ?? `${mobileApiOrigin}${path}`;
  const origin = useMemo(() => new URL(uri).origin, [uri]);
  const injectedJavaScript = useMemo(() => `
    (function() {
      function applyMinionAppStyle() {
        var root = document.documentElement;
        root.classList.toggle('dark', ${colorScheme === 'dark'});
        root.style.colorScheme = '${colorScheme}';
        var style = document.getElementById('minion-in-app-page-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'minion-in-app-page-style';
          style.textContent = ${JSON.stringify(HIDE_SITE_CHROME)};
          document.head.appendChild(style);
        }
      }
      applyMinionAppStyle();
      document.addEventListener('DOMContentLoaded', applyMinionAppStyle, { once: true });
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
      if (target.origin === origin) return true;
    } catch {
      return request.url === 'about:blank';
    }
    void Linking.openURL(request.url);
    return false;
  }, [origin]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: theme.pageBackground }]}>
    <View style={[styles.header, { backgroundColor: theme.pageBackground, borderBottomColor: theme.border }]}>
      <Pressable accessibilityLabel="이전 화면" accessibilityRole="button" hitSlop={6} onPress={goBack} style={styles.backButton}>
        <ChevronLeft color={theme.text} size={24} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color: theme.ink, ...fonts.bold }]}>{currentTitle}</Text>
      <View style={styles.headerBalance} />
    </View>
    <View style={styles.webViewWrap}>
      <WebView
        ref={webView}
        automaticallyAdjustContentInsets={false}
        domStorageEnabled
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled
        onError={() => { setFailed(true); setLoading(false); }}
        onLoadEnd={() => setLoading(false)}
        onLoadStart={() => { setFailed(false); setLoading(true); }}
        onNavigationStateChange={navigation => setCurrentTitle(navigation.title || title)}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        originWhitelist={['https://*', 'http://*', 'mailto:*', 'tel:*']}
        setSupportMultipleWindows={false}
        source={{ uri }}
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
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', height: 52, paddingHorizontal: 4 },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  title: { flex: 1, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  headerBalance: { width: 44 },
  webViewWrap: { flex: 1, position: 'relative' },
  webView: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
  retry: { borderRadius: 8, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
