import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Check from 'lucide-react-native/icons/check';
import Images from 'lucide-react-native/icons/images';
import Tags from 'lucide-react-native/icons/tags';
import UserRound from 'lucide-react-native/icons/user-round';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { mutateMobileApi, resolveApiAssetUrl, type MobileCommunityActionDto, type MobileMiniconCatalogDto, type MobileMiniconPack, type MobileMiniconSettingsDto } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

export function MiniconCatalogScreen() {
  const { data, error, loading, refresh } = useCachedQuery<MobileMiniconCatalogDto>('/api/mobile/v1/minicons');
  if (loading && !data) return <MinionScreen contentStyle={styles.screen}><Loading /></MinionScreen>;
  if (error && !data) return <MinionScreen contentStyle={styles.screen}><ErrorState onRetry={refresh} title={error} /></MinionScreen>;
  return <MinionScreen contentStyle={styles.screen}><Catalog packs={data?.packs ?? []} /></MinionScreen>;
}

export function MyMiniconsScreen() {
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const { data, error, loading, refresh } = useCachedQuery<MobileMiniconSettingsDto>('/api/mobile/v1/me/minicons', { cache: false, enabled: Boolean(session) });
  if (authLoading) return <MinionScreen contentStyle={styles.screen}><Loading /></MinionScreen>;
  if (!session) return <MinionScreen contentStyle={styles.screen}><View style={styles.loginState}><TextBody>로그인 후 사용할 미니콘을 선택할 수 있습니다.</TextBody><Pressable onPress={() => router.push('/login?next=/me/minicons' as never)} style={styles.loginButton}><ButtonText>로그인</ButtonText></Pressable></View></MinionScreen>;
  if (loading && !data) return <MinionScreen contentStyle={styles.screen}><Loading /></MinionScreen>;
  if (error && !data) return <MinionScreen contentStyle={styles.screen}><ErrorState onRetry={refresh} title={error} /></MinionScreen>;
  return <MinionScreen contentStyle={styles.screen}>{data ? <SettingsForm data={data} refresh={refresh} /> : null}</MinionScreen>;
}

function Catalog({ packs }: { packs: MobileMiniconPack[] }) {
  const { fonts, theme } = useMinionTheme();
  const [detail, setDetail] = useState<MobileMiniconPack | null>(null);
  return <View>
    <MiniconHeading />
    <MiniconTabs active="catalog" />
    <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5, marginBottom: 8, marginTop: 20, textAlign: 'right' }}>총 {packs.length}개</Text>
    {packs.length > 0 ? <PackGrid onPress={setDetail} packs={packs} /> : <View style={[styles.empty, { backgroundColor: theme.surfaceMuted }]}><TextBody>아직 공개된 미니콘이 없습니다.</TextBody></View>}
    <PackDetail onClose={() => setDetail(null)} pack={detail} />
  </View>;
}

function SettingsForm({ data, refresh }: { data: MobileMiniconSettingsDto; refresh: () => void }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [selectedPackIds, setSelectedPackIds] = useState(data.selectedPackIds);
  const [savedPackIds, setSavedPackIds] = useState(data.selectionSaved ? data.selectedPackIds : []);
  const [pending, setPending] = useState(false);
  const selected = useMemo(() => new Set(selectedPackIds), [selectedPackIds]);
  const changed = selectedPackIds.join(',') !== savedPackIds.join(',');
  const toggle = (pack: MobileMiniconPack) => {
    if (!selected.has(pack.id)) { setSelectedPackIds((current) => [...current, pack.id]); return; }
    if (selectedPackIds.length === 1) { showToast('미니콘 선택기에는 최소 한 개의 패키지가 필요합니다.', 'error'); return; }
    setSelectedPackIds((current) => current.filter((id) => id !== pack.id));
  };
  const save = async () => {
    if (!changed || pending) return;
    setPending(true);
    try {
      const result = await mutateMobileApi<MobileCommunityActionDto>('/api/mobile/v1/me/minicons', 'PATCH', { packIds: selectedPackIds });
      setSavedPackIds(selectedPackIds);
      showToast(result.message, 'success');
      refresh();
    } catch (caught) { showToast(caught instanceof Error ? caught.message : '미니콘 설정을 저장하지 못했습니다.', 'error'); }
    finally { setPending(false); }
  };
  return <View><MiniconHeading /><MiniconTabs active="mine" />{data.packs.length === 0 ? <View style={[styles.empty, styles.settingsEmpty, { backgroundColor: theme.surfaceMuted }]}><TextBody>사용할 수 있는 미니콘이 없습니다.</TextBody></View> : <><View style={styles.settingsHead}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>선택 {selectedPackIds.length} / 전체 {data.packs.length}</Text><Pressable disabled={!changed || pending} onPress={() => void save()} style={[styles.save, { backgroundColor: theme.ink, opacity: !changed || pending ? 0.45 : 1 }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{pending ? '저장 중' : changed ? '설정 저장' : '저장됨'}</Text></Pressable></View><PackGrid onPress={toggle} packs={data.packs} selected={selected} /></>}</View>;
}

function PackGrid({ onPress, packs, selected }: { onPress: (pack: MobileMiniconPack) => void; packs: MobileMiniconPack[]; selected?: Set<string> }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const cardWidth = Math.min(152, (width - 42) / 2);
  return <View style={styles.packGrid}>{packs.map((pack) => { const active = selected?.has(pack.id) ?? false; return <Pressable accessibilityState={selected ? { checked: active } : undefined} key={pack.id} onPress={() => onPress(pack)} style={[styles.packCard, { backgroundColor: active ? theme.surfaceMuted : 'transparent', width: cardWidth }]}><View style={[styles.cover, { backgroundColor: theme.surfaceMuted }]}><Image accessibilityLabel={`${pack.name} 대표 미니콘`} alt={`${pack.name} 대표 미니콘`} contentFit="cover" source={{ uri: resolveApiAssetUrl(pack.coverUrl) ?? pack.coverUrl }} style={StyleSheet.absoluteFill} />{selected ? <View style={[styles.check, { backgroundColor: active ? theme.accent : 'rgba(0,0,0,.3)' }]}><Check color={active ? theme.accentForeground : 'transparent'} size={16} strokeWidth={2.5} /></View> : null}</View><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22.5, marginTop: 6, paddingHorizontal: 2 }}>{pack.name}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5, marginTop: 2, paddingHorizontal: 2 }}>미니콘 {pack.items.length}개</Text></Pressable>; })}</View>;
}

function PackDetail({ onClose, pack }: { onClose: () => void; pack: MobileMiniconPack | null }) {
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  if (!pack) return <BottomSheet onClose={onClose} open={false} scrollable title="미니콘 정보" />;
  const creatorName = pack.creatorName ?? (pack.isOfficial ? 'MINION 운영팀' : '커뮤니티 제작자');
  const publishedDate = formatPublishedDate(pack.publishedAt);
  const tags = pack.tags ?? [pack.isOfficial ? '공식' : '사용자 제작', '미니콘'];
  const itemWidth = (width - 48) / 3;
  return <BottomSheet contentStyle={styles.detailSheetBody} onClose={onClose} open scrollable title={`${pack.name} 정보`}>
    <View>
      <Image accessibilityLabel={`${pack.name} 대표 미니콘`} alt={`${pack.name} 대표 미니콘`} contentFit="cover" source={{ uri: resolveApiAssetUrl(pack.coverUrl) ?? pack.coverUrl }} style={[styles.detailCover, { backgroundColor: theme.surfaceMuted }]} />
      <Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 27, marginTop: 16 }}>{pack.name}</Text>
      <Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 8 }}>{pack.description || '미니콘 패키지입니다.'}</Text>
      <View style={styles.detailMeta}>
        <MetaRow icon={<UserRound color={theme.muted} size={16} />} label="제작자" value={creatorName} />
        {publishedDate ? <MetaRow icon={<CalendarDays color={theme.muted} size={16} />} label="공개일" value={publishedDate} /> : null}
        <MetaRow icon={<Images color={theme.muted} size={16} />} label="구성" value={`미니콘 ${pack.items.length}개`} />
        <View style={styles.metaRow}><Tags color={theme.muted} size={16} /><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 21 }}>태그</Text><View style={styles.tags}>{tags.map((tag) => <View key={tag} style={[styles.tag, { backgroundColor: theme.surfaceMuted }]}><Text style={{ color: theme.text, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{tag}</Text></View>)}</View></View>
      </View>
      <View style={[styles.detailTitleRow, { borderBottomColor: theme.border }]}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18, lineHeight: 27 }}>포함된 미니콘</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5 }}>총 {pack.items.length}개</Text></View>
      <View style={styles.detailGrid}>{pack.items.map((item) => <View key={item.id} style={[styles.detailTile, { width: itemWidth }]}><Image accessibilityLabel={item.name} alt={item.name} contentFit="cover" source={{ uri: resolveApiAssetUrl(item.imageUrl) ?? item.imageUrl }} style={[styles.detailItem, { backgroundColor: theme.surfaceMuted, height: itemWidth, width: itemWidth }]} /><Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5, marginTop: 4, textAlign: 'center' }}>{item.name}</Text></View>)}</View>
    </View>
  </BottomSheet>;
}

function formatPublishedDate(value?: string | null) { if (!value) return null; const date = new Date(value); if (Number.isNaN(date.getTime())) return null; return new Intl.DateTimeFormat('ko-KR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date); }
export function MiniconHeading() { const { fonts, theme } = useMinionTheme(); return <Text accessibilityRole="header" style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28 }}>미니콘</Text>; }
export function MiniconTabs({ active }: { active: 'catalog' | 'mine' | 'apply' }) { const router = useRouter(); const { theme } = useMinionTheme(); return <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.card }]}><NavTab active={active === 'catalog'} label="전체 미니콘" onPress={() => router.push('/minicons' as never)} /><NavTab active={active === 'mine'} label="내 미니콘" onPress={() => router.push('/me/minicons' as never)} /><NavTab active={active === 'apply'} label="미니콘 신청" onPress={() => router.push('/minicons/apply' as never)} /></View>; }
function NavTab({ active = false, label, onPress }: { active?: boolean; label: string; onPress: () => void }) { const { fonts, theme } = useMinionTheme(); return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.navTab, active ? { backgroundColor: theme.surface, borderColor: theme.border } : { borderColor: 'transparent' }]}><Text numberOfLines={1} style={{ color: active ? theme.ink : theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{label}</Text></Pressable>; }
function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { const { fonts, theme } = useMinionTheme(); return <View style={styles.metaRow}>{icon}<Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 21 }}>{label}</Text><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, flex: 1, fontSize: 14, lineHeight: 21 }}>{value}</Text></View>; }
function TextBody({ children }: { children: React.ReactNode }) { const { fonts, theme } = useMinionTheme(); return <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>{children}</Text>; }
function ButtonText({ children }: { children: React.ReactNode }) { const { fonts, theme } = useMinionTheme(); return <Text style={{ color: theme.accentForeground, ...fonts.medium, fontSize: 14, lineHeight: 21 }}>{children}</Text>; }
function Loading() { const { theme } = useMinionTheme(); return <View style={styles.loading}><ActivityIndicator color={theme.accent} /></View>; }

const styles = StyleSheet.create({
  screen: { paddingBottom: 96 },
  tabs: { borderRadius: 10, flexDirection: 'row', gap: 2, marginTop: 12, padding: 3 },
  navTab: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, height: 32, justifyContent: 'center', minWidth: 0, paddingHorizontal: 8 },
  packGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  packCard: { borderRadius: 8, padding: 6 },
  cover: { aspectRatio: 1, borderRadius: 6, overflow: 'hidden' },
  check: { alignItems: 'center', borderRadius: 999, height: 28, justifyContent: 'center', position: 'absolute', right: 6, top: 6, width: 28 },
  empty: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 104, padding: 20 },
  loading: { alignItems: 'center', minHeight: 240, justifyContent: 'center' },
  loginState: { alignItems: 'center', gap: 16, padding: 20 },
  loginButton: { alignItems: 'center', backgroundColor: '#30d158', borderRadius: 8, justifyContent: 'center', minHeight: 40, paddingHorizontal: 20 },
  settingsHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: 16, paddingVertical: 4 },
  settingsEmpty: { marginTop: 20 },
  save: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 40, paddingHorizontal: 16 },
  detailCover: { alignSelf: 'center', borderRadius: 12, height: 180, width: 180 },
  detailSheetBody: { paddingHorizontal: 16 },
  detailMeta: { gap: 10, marginTop: 16 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 21 },
  tags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  detailTitleRow: { alignItems: 'flex-end', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingBottom: 8 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, marginTop: 12 },
  detailTile: { minWidth: 0 },
  detailItem: { borderRadius: 8 },
});
