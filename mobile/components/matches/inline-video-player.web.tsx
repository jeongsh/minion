import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

export function InlineVideoPlayer({ title, url }: { title: string; url: string }) {
  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        src: url,
        style: { border: 0, height: '100%', width: '100%' },
        title,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, backgroundColor: '#000000', borderRadius: 12, overflow: 'hidden', width: '100%' },
});
