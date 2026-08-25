import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FanEmpty, FanOwnerTabs, FanVideoThumbnail, buildFanOwnerTabs } from '@/components/fan/fan-shared';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileVideoItem } from '@/lib/api-client';

export function FanVideos({ items, teamName }: { items: MobileVideoItem[]; teamName: string }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [activeKey, setActiveKey] = useState('all');
  const [visibleCount, setVisibleCount] = useState(12);
  const normalized = useMemo(() => items.map((item) => ({ ...item, ownerName: item.channelName ?? teamName })), [items, teamName]);
  const tabs = useMemo(() => buildFanOwnerTabs(normalized, teamName), [normalized, teamName]);
  const filtered = activeKey === 'all' ? normalized : normalized.filter((item) => item.ownerName === activeKey);
  const visible = filtered.slice(0, visibleCount);

  async function openVideo(item: MobileVideoItem) {
    try { await Linking.openURL(item.url); } catch { showToast('영상을 열지 못했습니다.', 'error'); }
  }

  return (
    <View style={styles.page}>
      <FanOwnerTabs activeKey={activeKey} onChange={(key) => { setActiveKey(key); setVisibleCount(12); }} tabs={tabs} />
      {filtered.length ? (
        <>
        <View accessibilityLabel="영상 목록" style={styles.grid}>
          {visible.map((item) => <Pressable accessibilityLabel={`${item.title} 영상 열기`} accessibilityRole="link" key={item.id} onPress={() => void openVideo(item)} style={styles.card}><FanVideoThumbnail item={item} /></Pressable>)}
        </View>
        {visibleCount < filtered.length ? <Pressable onPress={() => setVisibleCount((count) => Math.min(filtered.length, count + 12))} style={[styles.moreButton, { borderColor: theme.border }]}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 13 }}>영상 더 보기</Text></Pressable> : filtered.length > 12 ? <Text style={[styles.complete, { color: theme.muted, fontFamily: fonts.medium }]}>모든 영상을 확인했습니다.</Text> : null}
        </>
      ) : <FanEmpty>아직 동기화된 YouTube 영상이 없습니다.</FanEmpty>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 0, width: '48.3%' },
  complete: { fontSize: 13, paddingVertical: 24, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, rowGap: 24 },
  moreButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 24, minHeight: 44 },
  page: { paddingHorizontal: 16, paddingVertical: 20 },
});
