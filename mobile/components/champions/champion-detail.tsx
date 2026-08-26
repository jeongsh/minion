import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ChampionBuildView } from '@/components/champions/champion-build';
import { DuoView, GamesView, MatchupView, ProView, StatsView } from '@/components/champions/champion-data-tabs';
import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileChampionDetailDto } from '@/lib/api-client';

type TabKey = 'overview' | 'matchups' | 'duos' | 'pros' | 'games' | 'stats';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '빌드' }, { key: 'matchups', label: '상대 전적' }, { key: 'duos', label: '조합' },
  { key: 'pros', label: '선수' }, { key: 'games', label: '경기' }, { key: 'stats', label: '통계' },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function percent(value: number | null) {
  return value == null ? '-' : `${value.toFixed(1)}%`;
}

function buildPath(slug: string, values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value && value !== 'all') params.set(key, value);
  });
  const query = params.toString();
  return `/api/mobile/v1/champions/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`;
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { fonts, theme } = useMinionTheme();
  return <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: active ? theme.ink : theme.card }]}><Text numberOfLines={1} style={{ color: active ? theme.surface : theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{label}</Text></Pressable>;
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={styles.filterSection}><Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{label}</Text><View style={styles.choiceGrid}>{children}</View></View>;
}

function Loading() {
  const { theme } = useMinionTheme();
  return <View style={styles.page}><View style={styles.profile}><View style={[styles.avatar, { backgroundColor: theme.surfaceMuted }]} /><View style={styles.loadingCopy}><View style={[styles.loadingTitle, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.loadingMeta, { backgroundColor: theme.surfaceMuted }]} /></View></View><View style={[styles.loadingSummary, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.loadingTabs, { backgroundColor: theme.surfaceMuted }]} /><View style={[styles.loadingPanel, { backgroundColor: theme.surfaceMuted }]} /></View>;
}

function ProfileHeader({ data, onChampionOpen, onPositionOpen }: { data: MobileChampionDetailDto; onChampionOpen: () => void; onPositionOpen: () => void }) {
  const { fonts, theme } = useMinionTheme();
  const uri = resolveApiAssetUrl(data.champion.image?.url) ?? data.champion.image?.url;
  const position = data.positions.find((item) => item.value === data.selectedPosition);
  return (
    <View style={styles.profile}>
        {uri ? <Image accessibilityLabel={data.champion.name} contentFit="cover" source={{ uri }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: theme.card }]} />}
        <View style={styles.profileCopy}>
          <View style={styles.nameRow}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.display, fontSize: 18, lineHeight: 25 }}>{data.champion.name}</Text><Pressable accessibilityLabel="챔피언 변경" onPress={onChampionOpen} style={[styles.swap, { backgroundColor: theme.card }]}><ArrowLeftRight color={theme.ink} size={18} /></Pressable></View>
          <Pressable onPress={onPositionOpen} style={styles.positionButton}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{position?.label ?? data.selectedPosition} · {position?.picks ?? 0}픽</Text><ChevronDown color={theme.muted} size={16} /></Pressable>
        </View>
    </View>
  );
}

type ScopeKey = 'season' | 'tournament' | 'patch';

function ScopeControls({ data, onOpen, patch, season, tournament }: { data: MobileChampionDetailDto; onOpen: (key: ScopeKey) => void; patch: string; season: string; tournament: string }) {
  const { fonts, theme } = useMinionTheme();
  const tournamentLabel = tournament === 'all' ? '전체 대회' : data.scope.tournaments.find((option) => option.value === tournament)?.label ?? '전체 대회';
  const controls: { key: ScopeKey; label: string }[] = [
    { key: 'season', label: `${season || data.scope.season} 시즌` },
    { key: 'tournament', label: tournamentLabel },
    { key: 'patch', label: patch === 'all' ? '전체 패치' : `${patch} 패치` },
  ];
  return (
    <View style={styles.scopeControls}>
      {controls.map((control) => (
        <Pressable key={control.key} onPress={() => onOpen(control.key)} style={[styles.scopeControl, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text numberOfLines={1} style={{ color: theme.ink, flex: 1, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{control.label}</Text>
          <ChevronDown color={theme.muted} size={16} />
        </Pressable>
      ))}
    </View>
  );
}

function Summary({ data }: { data: MobileChampionDetailDto }) {
  const { fonts, theme } = useMinionTheme();
  const metrics = [
    ['픽', String(data.summary.picks)], ['밴', String(data.summary.bans)], ['픽밴률', percent(data.summary.presenceRate)],
    ['승률', percent(data.summary.winRate)], ['전적', `${data.summary.wins}-${data.summary.losses}`],
  ];
  return (
    <View style={[styles.summary, { borderColor: theme.border }]}>
      <View style={[styles.summaryHeader, { backgroundColor: theme.card }]}>{metrics.map(([label]) => <Text key={label} style={{ color: theme.muted, flex: 1, ...fonts.regular, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>{label}</Text>)}</View>
      <View style={styles.summaryValues}>{metrics.map(([label, value], index) => <View key={label} style={[styles.summaryValue, index > 0 && { borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth }]}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 15, lineHeight: 20 }}>{value}</Text></View>)}</View>
    </View>
  );
}

function TabNav({ active, data, onSelect }: { active: TabKey; data: MobileChampionDetailDto; onSelect: (tab: TabKey) => void }) {
  const { fonts, theme } = useMinionTheme();
  const tabs = TABS.filter((tab) => tab.key !== 'duos' || data.selectedPosition === 'BOT' || data.selectedPosition === 'SUP');
  return (
    <View style={styles.tabRail}>
      <View style={[styles.tabShell, { backgroundColor: theme.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => {
            const selected = active === tab.key;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab.key}
                onPress={() => onSelect(tab.key)}
                style={[styles.tab, { backgroundColor: selected ? theme.ink : 'transparent', borderColor: selected ? theme.ink : 'transparent' }]}
              >
                <Text numberOfLines={1} style={{ color: selected ? theme.surface : theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 20 }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function ChampionDetail() {
  const params = useLocalSearchParams<{ championSlug: string; season?: string; tournament?: string; patch?: string; position?: string; tab?: string }>();
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const slug = first(params.championSlug) ?? '';
  const initialTab = TABS.some((tab) => tab.key === first(params.tab)) ? first(params.tab) as TabKey : 'overview';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [season, setSeason] = useState(first(params.season) ?? '');
  const [tournament, setTournament] = useState(first(params.tournament) ?? 'all');
  const [patch, setPatch] = useState(first(params.patch) ?? 'all');
  const [position, setPosition] = useState(first(params.position) ?? '');
  const [scopeOpen, setScopeOpen] = useState<ScopeKey | null>(null);
  const [positionOpen, setPositionOpen] = useState(false);
  const [championOpen, setChampionOpen] = useState(false);
  const path = useMemo(() => buildPath(slug, { season, tournament, patch, position }), [patch, position, season, slug, tournament]);
  const { data, error, loading, refresh } = useCachedQuery<MobileChampionDetailDto>(path, { enabled: Boolean(slug) });
  useEffect(() => { if (!season && data?.scope.season) setSeason(String(data.scope.season)); }, [data?.scope.season, season]);
  useEffect(() => { if (!position && data?.selectedPosition) setPosition(data.selectedPosition); }, [data?.selectedPosition, position]);
  useEffect(() => { if (tab === 'duos' && data && data.selectedPosition !== 'BOT' && data.selectedPosition !== 'SUP') setTab('stats'); }, [data, tab]);

  if (loading && !data) return <MinionScreen><Loading /></MinionScreen>;
  if (error && !data) return <MinionScreen><ErrorState onRetry={refresh} title={error} /></MinionScreen>;
  if (!data) return <MinionScreen><ErrorState onRetry={refresh} title="챔피언 정보를 찾을 수 없습니다." /></MinionScreen>;

  const scope = data.scope;
  const view = tab === 'overview' ? <ChampionBuildView build={data.build} />
    : tab === 'matchups' ? <MatchupView rows={data.matchups} />
      : tab === 'duos' ? <DuoView rows={data.duos} />
        : tab === 'pros' ? <ProView rows={data.pros} />
          : tab === 'games' ? <GamesView rows={data.games} />
            : <StatsView stats={data.stats} totalGames={data.summary.picks} />;

  const navigateChampion = (nextSlug: string) => {
    setChampionOpen(false);
    const query = new URLSearchParams();
    if (season) query.set('season', season);
    if (tournament !== 'all') query.set('tournament', tournament);
    if (patch !== 'all') query.set('patch', patch);
    if (position) query.set('position', position);
    if (tab !== 'overview') query.set('tab', tab);
    router.replace(`/champions/${nextSlug}${query.toString() ? `?${query}` : ''}` as never);
  };

  return (
    <MinionScreen>
      <View style={styles.page}>
        <ProfileHeader data={data} onChampionOpen={() => setChampionOpen(true)} onPositionOpen={() => setPositionOpen(true)} />
        <ScopeControls data={data} onOpen={setScopeOpen} patch={patch} season={season} tournament={tournament} />
        <Summary data={data} />
        <TabNav active={tab} data={data} onSelect={setTab} />
        {view}
      </View>
      <BottomSheet contentStyle={styles.sheet} onClose={() => setScopeOpen(null)} open={scopeOpen != null} scrollable title={scopeOpen === 'season' ? '시즌' : scopeOpen === 'tournament' ? '대회' : '패치'}>
        {scopeOpen === 'season' ? <FilterSection label="시즌">{scope.seasons.map((value) => <Choice active={season === String(value)} key={value} label={String(value)} onPress={() => { setSeason(String(value)); setScopeOpen(null); }} />)}</FilterSection> : null}
        {scopeOpen === 'tournament' ? <FilterSection label="대회"><Choice active={tournament === 'all'} label="전체" onPress={() => { setTournament('all'); setScopeOpen(null); }} />{scope.tournaments.map((option) => <Choice active={tournament === option.value} key={option.value} label={option.label} onPress={() => { setTournament(option.value); setScopeOpen(null); }} />)}</FilterSection> : null}
        {scopeOpen === 'patch' ? <FilterSection label="패치"><Choice active={patch === 'all'} label="전체" onPress={() => { setPatch('all'); setScopeOpen(null); }} />{scope.patches.map((value) => <Choice active={patch === value} key={value} label={value} onPress={() => { setPatch(value); setScopeOpen(null); }} />)}</FilterSection> : null}
      </BottomSheet>
      <BottomSheet contentStyle={styles.sheet} onClose={() => setPositionOpen(false)} open={positionOpen} title="포지션">
        <View style={styles.choiceGrid}>{data.positions.map((option) => <Choice active={data.selectedPosition === option.value} key={option.value} label={`${option.label} · ${option.picks}픽`} onPress={() => { setPosition(option.value); setPositionOpen(false); }} />)}</View>
      </BottomSheet>
      <BottomSheet contentStyle={styles.championSheet} onClose={() => setChampionOpen(false)} open={championOpen} scrollable title="챔피언 선택">
        <View style={styles.championGrid}>{data.champions.map((champion) => {
          const uri = resolveApiAssetUrl(champion.image?.url) ?? champion.image?.url;
          return <Pressable key={champion.id} onPress={() => navigateChampion(champion.slug)} style={styles.championChoice}>{uri ? <Image contentFit="cover" source={{ uri }} style={styles.championFace} /> : null}<Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{champion.name}</Text></Pressable>;
        })}</View>
      </BottomSheet>
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingTop: 8 },
  profile: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minWidth: 0 },
  avatar: { borderRadius: 12, height: 56, width: 56 },
  profileCopy: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  swap: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', width: 40 },
  positionButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 3, minHeight: 28 },
  scopeControls: { flexDirection: 'row', gap: 6 },
  scopeControl: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 4, height: 40, minWidth: 0, paddingHorizontal: 8 },
  summary: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', height: 32 },
  summaryValues: { flexDirection: 'row', height: 44 },
  summaryValue: { alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0, paddingHorizontal: 2 },
  tabRail: { paddingVertical: 8 },
  tabShell: { borderRadius: 12, padding: 4 },
  tabs: { gap: 4, minWidth: '100%' },
  tab: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, height: 36, justifyContent: 'center', minWidth: 62, paddingHorizontal: 8 },
  sheet: { gap: 20, padding: 16 },
  filterSection: { gap: 8 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 40, minWidth: '30%', paddingHorizontal: 12 },
  championSheet: { padding: 12 },
  championGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  championChoice: { alignItems: 'center', gap: 4, paddingVertical: 4, width: '18%' },
  championFace: { borderRadius: 7, height: 40, width: 40 },
  loadingCopy: { flex: 1, gap: 8 },
  loadingTitle: { borderRadius: 5, height: 20, width: 96 },
  loadingMeta: { borderRadius: 4, height: 14, width: 72 },
  loadingSummary: { borderRadius: 8, height: 78 },
  loadingTabs: { borderRadius: 12, height: 44 },
  loadingPanel: { borderRadius: 8, height: 420 },
});
