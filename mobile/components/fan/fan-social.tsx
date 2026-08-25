import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { FanEmpty, FanOwnerTabs, InstagramGlyph, buildFanOwnerTabs } from '@/components/fan/fan-shared';
import { FanInstagramModal } from '@/components/fan/fan-instagram-modal';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamDetailDto } from '@/lib/api-client';

type SocialItem = MobileTeamDetailDto['social'][number];

export function FanSocial({ items, teamName }: { items: SocialItem[]; teamName: string }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const [activeKey, setActiveKey] = useState('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const tabs = useMemo(() => buildFanOwnerTabs(items, teamName), [items, teamName]);
  const filtered = activeKey === 'all' ? items : items.filter((item) => item.ownerName === activeKey);
  const visible = filtered.slice(0, visibleCount);
  const itemWidth = (width - 34) / 3;

  return (
    <View style={styles.page}>
      <View style={styles.tabsWrap}><FanOwnerTabs activeKey={activeKey} onChange={(key) => { setActiveKey(key); setVisibleCount(15); }} tabs={tabs} /></View>
      {filtered.length ? (
        <>
        <View accessibilityLabel="소셜 피드" style={[styles.grid, { backgroundColor: '#000000' }]}>
          {visible.map((item, index) => {
            const imageUrl = resolveApiAssetUrl(item.image?.url);
            return (
              <Pressable accessibilityLabel={`${item.ownerName} Instagram 게시물 열기`} key={item.id} onPress={() => setOpenIndex(index)} style={[styles.post, { backgroundColor: theme.surfaceMuted, width: itemWidth }]}>
                {imageUrl ? <Image contentFit="cover" source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} transition={120} /> : <InstagramGlyph color={theme.muted} size={30} />}
                <InstagramGlyph color="#ffffff" size={16} style={styles.instagramIcon} />
              </Pressable>
            );
          })}
        </View>
        {visibleCount < filtered.length ? <Pressable onPress={() => setVisibleCount((count) => Math.min(filtered.length, count + 15))} style={[styles.moreButton, { borderColor: theme.border }]}><Text style={{ color: theme.text, fontFamily: fonts.bold, fontSize: 13 }}>게시물 더 보기</Text></Pressable> : filtered.length > 15 ? <Text style={[styles.complete, { color: theme.muted, fontFamily: fonts.medium }]}>모든 게시물을 확인했습니다.</Text> : null}
        </>
      ) : <FanEmpty>아직 새 게시물이 없습니다.</FanEmpty>}
      {openIndex !== null ? <FanInstagramModal items={filtered} onClose={() => setOpenIndex(null)} startIndex={openIndex} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  instagramIcon: { position: 'absolute', right: 10, top: 10 },
  complete: { fontSize: 13, paddingVertical: 24, textAlign: 'center' },
  moreButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 44 },
  page: { paddingHorizontal: 16, paddingVertical: 20 },
  post: { alignItems: 'center', aspectRatio: 3 / 4, justifyContent: 'center', overflow: 'hidden' },
  tabsWrap: { marginBottom: 16 },
});
