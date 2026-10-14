import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { HomeSectionHeading } from '@/components/home/home-section-heading';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';
import type { HomeInsights } from '../../../packages/contracts/src/home-insights';

const percent = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;

function PresenceRing({ value }: { value: number | null }) {
  const { fonts, theme } = useMinionTheme();
  const circumference = 2 * Math.PI * 39;
  return <View accessibilityLabel={`픽밴률 ${percent(value)}`} style={styles.ring}><Svg width={60} height={60} viewBox="0 0 88 88" style={{ transform: [{ rotate: '-90deg' }] }}><Circle cx={44} cy={44} r={39} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={5} /><Circle cx={44} cy={44} r={39} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, value ?? 0)) / 100)} /></Svg><View style={styles.ringCopy}><Text style={{ color: '#fff', ...fonts.medium, fontSize: 12, lineHeight: 16 }}>{percent(value)}</Text><Text style={{ color: 'rgba(255,255,255,0.75)', ...fonts.regular, fontSize: 13, lineHeight: 16 }}>픽밴률</Text></View></View>;
}

export function HomeMetaSection({ data, cardWidth }: { data?: HomeInsights | null; cardWidth: number }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View><HomeSectionHeading title="대회 메타" href={data?.href ?? '/champions'} />{data?.champions.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={{ gap: 12 }}>{data.champions.map((champion) => <Pressable accessibilityRole="link" key={champion.id} onPress={() => router.navigate(champion.href as never)} style={[styles.card, { width: cardWidth, backgroundColor: theme.card }]}><Image source={{ uri: resolveApiAssetUrl(champion.artwork) ?? undefined }} contentFit="cover" contentPosition={{ left: '50%', top: '25%' }} style={StyleSheet.absoluteFill} /><LinearGradient colors={['rgba(0,0,0,0.65)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '33%' }} /><LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }} /><Text numberOfLines={1} style={{ position: 'absolute', top: 8, left: 8, right: 8, color: '#fff', ...fonts.bold, fontSize: 15, lineHeight: 20 }}>{champion.name}</Text><View style={styles.metaCopy}><View style={{ flex: 1, gap: 4 }}>{[['픽', champion.picks], ['밴', champion.bans]].map(([label, count]) => <View key={label} style={{ flexDirection: 'row', gap: 4 }}><Text style={{ color: 'rgba(255,255,255,0.75)', ...fonts.regular, fontSize: 13, lineHeight: 16 }}>{label}</Text><Text style={{ color: '#fff', ...fonts.medium, fontSize: 13, lineHeight: 16 }}>{count}회</Text></View>)}</View><PresenceRing value={champion.presence} /></View></Pressable>)}</ScrollView> : <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, paddingVertical: 24 }}>대회 기록이 없습니다.</Text>}</View>;
}

export function HomeBuildSection({ data, cardWidth }: { data?: HomeInsights | null; cardWidth: number }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  return <View><HomeSectionHeading title="프로 선수 빌드" href="/schedule" />{data?.builds.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={{ gap: 12 }}>{data.builds.map((build) => <Pressable key={build.id} accessibilityRole="link" accessibilityLabel={`${build.player} ${build.champion} 빌드`} onPress={() => router.navigate(build.href as never)} style={[styles.card, { width: cardWidth, backgroundColor: theme.card }]}><Image source={{ uri: resolveApiAssetUrl(build.artwork) ?? undefined }} contentFit="cover" contentPosition={{ left: '50%', top: '25%' }} style={StyleSheet.absoluteFill} /><LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }} /><View style={styles.buildCopy}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{build.playerImage ? <Image source={{ uri: resolveApiAssetUrl(build.playerImage) ?? undefined }} contentFit="cover" contentPosition="top" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)' }} /> : null}<Text numberOfLines={1} style={{ flex: 1, color: '#fff', ...fonts.bold, fontSize: 15, lineHeight: 20 }}>{build.player}</Text></View><View accessibilityLabel="경기 종료 아이템" style={styles.items}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={{ width: '30%', alignItems: 'center' }}>{build.items[index] ? <Image accessibilityLabel={build.items[index].name} source={{ uri: resolveApiAssetUrl(build.items[index].image) ?? undefined }} style={styles.item} /> : <View style={[styles.item, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />}</View>)}</View></View></Pressable>)}</ScrollView> : <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, paddingVertical: 24 }}>빌드 기록이 없습니다.</Text>}</View>;
}

const styles = StyleSheet.create({ card: { aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden' }, ring: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.75)' }, ringCopy: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' }, metaCopy: { position: 'absolute', left: 6, right: 6, bottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }, buildCopy: { position: 'absolute', left: 8, right: 8, bottom: 8, gap: 8 }, items: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, borderRadius: 8, padding: 6, backgroundColor: 'rgba(0,0,0,0.5)' }, item: { width: 28, height: 28, borderRadius: 6 } });
