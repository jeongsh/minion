import { Image } from 'expo-image';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, type SvgProps } from 'react-native-svg';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobilePlayerDirectoryItem, type MobileVideoItem } from '@/lib/api-client';

export const FAN_POSITION_ORDER = ['TOP', 'JGL', 'MID', 'BOT', 'SUP', 'COACH'];

export function InstagramGlyph({ color = 'currentColor', size = 24, ...props }: SvgProps & { color?: string; size?: number }) {
  return <Svg fill={color} height={size} viewBox="0 0 24 24" width={size} {...props}><Path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></Svg>;
}

export function FanSectionHeading({ children, href }: { children: ReactNode; href?: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.headingRow}>
      <Text style={[styles.heading, { color: theme.ink, fontFamily: fonts.display }]}>{children}</Text>
      {href ? (
        <Pressable accessibilityRole="link" onPress={() => router.navigate(href as never)} style={styles.headingLink}>
          <Text style={[styles.headingLinkText, { color: theme.muted, fontFamily: fonts.bold }]}>전체보기</Text>
          <ChevronRight color={theme.muted} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FanPlayerCard({ href, player, teamName }: { href: string; player: MobilePlayerDirectoryItem; teamName: string }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const imageUrl = resolveApiAssetUrl(player.profileImage?.url);
  const meta = `${teamName}${player.realName ? ` · ${player.realName}` : ''}`;
  return (
    <Pressable
      accessibilityLabel={`${player.name} ${player.position ?? ''} ${meta}`}
      accessibilityRole="link"
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [styles.playerCard, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.82 : 1 }]}
    >
      <View style={[styles.playerImage, { backgroundColor: theme.card }]}> 
        {imageUrl ? (
          <Image accessibilityLabel={player.name} contentFit="cover" contentPosition="top" source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} transition={120} />
        ) : (
          <View style={styles.playerFallback}><Text style={{ color: theme.muted, fontFamily: fonts.black, fontSize: 18 }}>{player.name.slice(0, 2).toUpperCase()}</Text></View>
        )}
        <View style={styles.positionBadge}>
          <Text style={{ color: '#ffffff', fontFamily: fonts.medium, fontSize: 11, lineHeight: 16.5 }}>{player.position}</Text>
        </View>
      </View>
      <View style={styles.playerBody}>
        <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 16, lineHeight: 24 }}>{player.name}</Text>
        <Text numberOfLines={1} style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13, lineHeight: 19.5, marginTop: 2 }}>{meta}</Text>
      </View>
    </Pressable>
  );
}

export type FanOwnerTab = { count: number; key: string; label: string };

export function buildFanOwnerTabs(items: { ownerName: string }[], teamName: string): FanOwnerTab[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.ownerName, (counts.get(item.ownerName) ?? 0) + 1);
  const tabs: FanOwnerTab[] = [{ count: items.length, key: 'all', label: '전체' }];
  if (counts.has(teamName)) tabs.push({ count: counts.get(teamName) ?? 0, key: teamName, label: '구단' });
  for (const name of [...counts.keys()].filter((name) => name !== teamName).sort((a, b) => a.localeCompare(b, 'ko'))) {
    tabs.push({ count: counts.get(name) ?? 0, key: name, label: name });
  }
  return tabs;
}

export function FanOwnerTabs({ activeKey, onChange, tabs }: { activeKey: string; onChange: (key: string) => void; tabs: FanOwnerTab[] }) {
  const { fonts, theme } = useMinionTheme();
  if (tabs.length <= 2) return null;
  return (
    <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            disabled={active}
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, active ? { backgroundColor: theme.ink, borderColor: theme.ink } : { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={{ color: active ? theme.surface : theme.text, fontFamily: fonts.bold, fontSize: 13, lineHeight: 19.5 }}>{tab.label}</Text>
            <Text style={{ color: active ? theme.surface : theme.muted, fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, opacity: active ? 0.7 : 1 }}>{tab.count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function FanVideoThumbnail({ compact = false, item }: { compact?: boolean; item: MobileVideoItem }) {
  const { fonts, theme } = useMinionTheme();
  const imageUrl = resolveApiAssetUrl(item.thumbnail?.url);
  const isNew = item.publishedAt ? Date.now() - new Date(item.publishedAt).getTime() <= 5 * 24 * 60 * 60 * 1000 : false;
  return (
    <>
      <View style={[styles.videoImage, { backgroundColor: '#17181b' }]}> 
        {imageUrl ? <Image contentFit="cover" source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} transition={120} /> : <Text style={[styles.youtubeFallback, { fontFamily: fonts.bold }]}>YouTube</Text>}
        {isNew ? <View style={styles.newBadge}><Text style={{ color: '#ffffff', fontFamily: fonts.medium, fontSize: 12, lineHeight: 18 }}>NEW</Text></View> : null}
      </View>
      <Text numberOfLines={2} style={[compact ? styles.videoCompactTitle : styles.videoTitle, { color: theme.ink, fontFamily: fonts.medium }]}>{item.title}</Text>
      <Text numberOfLines={1} style={[compact ? styles.videoOwnerPill : styles.videoOwner, { borderColor: theme.muted, color: theme.muted, fontFamily: fonts.medium }]}>{item.channelName ?? ''}</Text>
    </>
  );
}

export function FanEmpty({ children }: { children: ReactNode }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.empty, { borderColor: theme.border }]}><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 128, padding: 24 },
  heading: { fontSize: 16, lineHeight: 24 },
  headingLink: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto' },
  headingLinkText: { fontSize: 14, lineHeight: 21 },
  headingRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 16, justifyContent: 'space-between', marginBottom: 12 },
  newBadge: { backgroundColor: '#dc2626', borderRadius: 4, left: 6, paddingHorizontal: 6, paddingVertical: 2, position: 'absolute', top: 6 },
  playerBody: { padding: 12 },
  playerCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', width: '48.6%' },
  playerFallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  playerImage: { aspectRatio: 4 / 5, overflow: 'hidden', position: 'relative', width: '100%' },
  positionBadge: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 8 },
  tab: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: 36, paddingHorizontal: 12, paddingVertical: 8 },
  tabs: { gap: 8, paddingBottom: 4 },
  videoCompactTitle: { fontSize: 13, lineHeight: 16, marginTop: 8 },
  videoImage: { aspectRatio: 16 / 9, borderRadius: 8, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: '100%' },
  videoOwner: { borderWidth: 0, fontSize: 12, lineHeight: 18, marginTop: 4 },
  videoOwnerPill: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, fontSize: 12, lineHeight: 16, marginTop: 8, maxWidth: '100%', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  videoTitle: { fontSize: 12, lineHeight: 16, marginTop: 8 },
  youtubeFallback: { alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
