import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export function InlineVideoPlayer({ title, url }: { title: string; url: string }) {
  return (
    <View style={styles.frame}>
      <WebView
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        originWhitelist={['https://*', 'http://*']}
        source={{ uri: url }}
        style={styles.webView}
        title={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, backgroundColor: '#000000', borderRadius: 12, overflow: 'hidden', width: '100%' },
  webView: { backgroundColor: '#000000', flex: 1 },
});
