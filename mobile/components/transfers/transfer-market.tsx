import { Image } from 'expo-image';
import ChevronsRight from 'lucide-react-native/icons/chevrons-right';
import Search from 'lucide-react-native/icons/search';
import UserRound from 'lucide-react-native/icons/user-round';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { ErrorState } from '@/components/feedback-states';
import { FilterSelect } from '@/components/filter-select';
import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileTeamsPageDto } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import type { MobileTransfersDto } from '../../../packages/contracts/src/mobile-v1';
import { departuresForTeam, resolveTransferRosters } from '../../../packages/contracts/src/transfer-view';
import { transferArticleUrl, latestPlayerEvents, lckTeamCode, marketEvents, movementCategory, normalizeTransferName, TRANSFER_KIND_LABELS, TRANSFER_ROLES, type TransferEvent, type TransferRole } from '../../../packages/contracts/src/transfers';

const ROLE_ICONS: Record<string, string> = { TOP: 'top', JGL: 'jungle', MID: 'middle', BOT: 'bottom', SUP: 'utility' };
const ROLE_LABELS: Record<TransferRole, string> = { TOP: '탑', JGL: '정글', MID: '미드', BOT: '원딜', SUP: '서포터', COACH: '감독' };
const TABS = [{ key: 'rosters', label: '팀별 로스터' }, { key: 'moves', label: '선수 이동' }, { key: 'fa', label: 'FA' }];
const MOVEMENTS = [{ value: 'all', label: '전체 변동' }, { value: 'domestic', label: 'LCK 내 이동' }, { value: 'outgoing', label: 'LCK 이탈' }, { value: 'incoming', label: 'LCK 합류' }, { value: 'renew', label: '재계약' }, { value: 'leave', label: '계약 종료' }, { value: 'retire', label: '은퇴' }, { value: 'inactive', label: '휴식 / 군 복무' }];
const destination = (event: TransferEvent) => event.to || (event.kind === 'retire' ? '은퇴' : event.kind === 'inactive' ? '휴식 / 군 복무' : '행선지 미정');

export function TransferMarketScreen({ season }: { season?: string }) {
  const path = `/api/mobile/v1/transfers${season ? `?season=${encodeURIComponent(season)}` : ''}`;
  const query = useCachedQuery<MobileTransfersDto>(path);
  const { session, loading: authLoading } = useAuth();
  const followed = useCachedQuery<MobileTeamsPageDto>('/api/mobile/v1/teams?view=directory', { cache: 'memory', cacheScope: session?.user.id ?? 'guest', enabled: !authLoading });
  const { fonts, theme } = useMinionTheme();
  const { width } = useWindowDimensions();
  return <KeyboardAwareView style={{ flex: 1 }}><MinionScreen contentStyle={styles.content}>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.ink, ...fonts.display, fontSize: width >= 640 ? 28 : 20, lineHeight: width >= 640 ? 42 : 28 }]}>이적시장</Text>
    {query.loading && !query.data ? <TransferLoading /> : query.error && !query.data ? <ErrorState onRetry={query.refresh} /> : query.data?.market ? <TransferMarketView data={query.data} followedTeamIds={followed.data?.followedTeamIds ?? []} /> : <Text style={[styles.empty, { backgroundColor: theme.card, color: theme.muted, ...fonts.regular }]}>이적시장 소식을 준비하고 있습니다.</Text>}
  </MinionScreen></KeyboardAwareView>;
}

function RoleIcon({ role }: { role: TransferRole }) {
  const { theme } = useMinionTheme();
  return role === 'COACH' ? <UserRound accessibilityLabel="감독" color={theme.muted} size={18} style={{ width: 20 }} /> : <Image accessibilityLabel={ROLE_LABELS[role]} contentFit="contain" tintColor={theme.muted} source={{ uri: resolveApiAssetUrl(`/objectives/position-${ROLE_ICONS[role]}.svg`) ?? undefined }} style={{ height: 20, width: 20 }} />;
}

function TransferMarketView({ data, followedTeamIds }: { data: MobileTransfersDto; followedTeamIds: string[] }) {
  const market = data.market!;
  const { width } = useWindowDimensions();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const [tab, setTab] = useState('rosters');
  const [teamFilter, setTeamFilter] = useState('all');
  const [movement, setMovement] = useState('all');
  const [role, setRole] = useState('all');
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState(true);
  const allEvents = useMemo(() => marketEvents(market), [market]);
  const events = allEvents.filter((event) => reports || event.provenance !== 'report');
  const rosters = useMemo(() => resolveTransferRosters(market.snapshot.rosters, allEvents, market.season), [market, allEvents]);
  const teams = new Map(data.teams.flatMap((team) => { const code = lckTeamCode(team.shortName); return code ? [[code, team] as const] : []; }));
  const teamNames = new Map(data.teams.flatMap((team) => [team.name, team.shortName, team.slug].map((name) => [normalizeTransferName(name), team] as const)));
  const isFollowed = (code: string) => { const team = teams.get(code); return team && (followedTeamIds.includes(team.id) || followedTeamIds.includes(team.fanSiteHost)); };
  const ordered = [...rosters].sort((a, b) => Number(Boolean(isFollowed(b.team))) - Number(Boolean(isFollowed(a.team))));
  const latest = latestPlayerEvents(events.filter((event) => event.provenance !== 'report'));
  const freeAgents = latest.filter((event) => event.kind === 'leave' && !event.to);
  const keyword = normalizeTransferName(query);
  const matchesTeam = (event: TransferEvent) => teamFilter === 'all' || lckTeamCode(event.from) === teamFilter || lckTeamCode(event.to) === teamFilter || market.snapshot.rosters.find((roster) => roster.team === teamFilter)?.slots.some((slot) => slot.previous.some((person) => normalizeTransferName(person.name) === normalizeTransferName(event.player)));
  const matching = (event: TransferEvent) => matchesTeam(event) && (role === 'all' || role === event.role) && (!keyword || normalizeTransferName(`${event.player} ${event.realName}`).includes(keyword));
  const recentEvents = allEvents.filter((event) => event.provenance !== 'report' && matchesTeam(event));
  const visibleEvents = (tab === 'fa' ? freeAgents : events).filter((event) => matching(event) && (tab === 'fa' || movement === 'all' || movementCategory(event) === movement || (movement === 'outgoing' && movementCategory(event) === 'tracked')));

  const playerEvents = new Map(latestPlayerEvents(events).map((event) => [normalizeTransferName(event.player), event]));

  function playerName(name: string, muted = false, event = playerEvents.get(normalizeTransferName(name))) {
    const url = transferArticleUrl(event);
    const text = <Text numberOfLines={1} style={{ color: muted ? theme.muted : theme.ink, ...(muted ? fonts.medium : fonts.bold), fontSize: 15, lineHeight: 20 }}>{name}</Text>;
    return url ? <Pressable accessibilityRole="link" accessibilityLabel={`${name} 원문 뉴스`} onPress={() => { void Linking.openURL(url).catch(() => Alert.alert("원문 뉴스를 열지 못했습니다.", "잠시 후 다시 시도해 주세요.")); }} style={{ maxWidth: '100%' }}>{text}</Pressable> : text;
  }
  function teamName(name: string, compact = false, hideLabel = false) {
    const code = lckTeamCode(name);
    const team = (code ? teams.get(code) : undefined) ?? teamNames.get(normalizeTransferName(name));
    return <View accessibilityLabel={code === 'DNS' ? 'DN SOOPers' : team?.name ?? name} style={[styles.teamName, compact && { maxWidth: 80 }]}>{team?.logo ? <TeamLogo plain size={20} team={team} themeAware /> : null}{!hideLabel || !team?.logo ? <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{team?.shortName ?? name}</Text> : null}</View>;
  }
  function arrow() { return <ChevronsRight color={theme.muted} size={18} strokeWidth={1.75} />; }
  function movementSummary(label: string, moves: TransferEvent[], incoming: boolean, team: string) {
    const hideLabel = (width - 34) / 2 < 220;
    return <View accessibilityLabel={`${team} ${label}`} style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? theme.card : theme.surface }}>
      <View style={[styles.rosterHeader, { backgroundColor: theme.card, borderBottomColor: theme.divider }]}><Text style={{ color: incoming ? theme.accent : theme.ink, ...fonts.bold, fontSize: 16 }}>{label}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{moves.length}</Text></View>
      {moves.length ? moves.map((event, index) => <View key={event.id} accessibilityLabel={`${event.player} ${event.from || '이전 팀 미정'}에서 ${destination(event)}`} style={[styles.moveRow, { backgroundColor: colorScheme === 'dark' && index % 2 === 0 ? theme.cardHover : undefined, borderBottomColor: theme.divider, borderBottomWidth: colorScheme === 'dark' ? 0 : 1 }]}><RoleIcon role={event.role} /><View style={{ flex: 1, gap: 4 }}>{playerName(event.player, false, event)}<View style={styles.teamName}>{teamName(event.from || '미정', true, hideLabel)}{arrow()}{teamName(destination(event), true, hideLabel)}</View></View></View>) : <View style={{ height: 56, justifyContent: 'center', paddingHorizontal: 12 }}><Text accessibilityLabel={`${label} 없음`} style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>—</Text></View>}
    </View>;
  }
  return <View>
    <View style={styles.mb16}>{recentEvents.length ? <ScrollView accessibilityLabel="최근 변동" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{recentEvents.map((event) => <View key={event.id} style={[styles.recent, { backgroundColor: theme.card, maxWidth: width - 32 }]}><Text style={[styles.badge, { color: theme.accent, backgroundColor: theme.surface, ...fonts.medium }]}>{TRANSFER_KIND_LABELS[event.kind]}</Text>{playerName(event.player, false, event)}<View style={styles.teamName}>{teamName(event.from || '미정', true)}{event.kind !== 'renew' ? <>{arrow()}{teamName(destination(event), true)}</> : null}</View></View>)}</ScrollView> : <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16 }}>확인된 변동이 없습니다.</Text>}</View>
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.card }]}>{TABS.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && { backgroundColor: colorScheme === 'dark' ? theme.border : theme.surface, borderColor: theme.border }]}><Text style={{ color: tab === item.key ? theme.ink : theme.muted, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{item.label}</Text></Pressable>)}</View>
    <View style={[styles.filters, { zIndex: 30 }]}><View style={{ width: 140, zIndex: 33 }}><FilterSelect compact label="팀" accessibilityLabel="팀 선택" value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: '전체 팀' }, ...ordered.map((roster) => ({ value: roster.team, label: roster.team === 'DNS' ? 'DN SOOPers' : teams.get(roster.team)?.shortName ?? roster.team }))]} /></View>
      {tab !== 'rosters' ? <>{tab === 'moves' ? <View style={{ width: 128, zIndex: 32 }}><FilterSelect compact label="변동 종류" value={movement} onChange={setMovement} options={MOVEMENTS} /></View> : null}<View style={{ width: 128, zIndex: 31 }}><FilterSelect compact label="포지션" value={role} onChange={setRole} options={[{ value: 'all', label: '전체 포지션' }, ...[...TRANSFER_ROLES, 'COACH' as const].map((value) => ({ value, label: ROLE_LABELS[value] }))]} /></View>{tab === 'moves' ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: reports }} onPress={() => setReports(!reports)} style={{ height: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ height: 14, width: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: reports ? theme.accent : theme.surface }} /><Text style={{ color: theme.text, ...fonts.medium, fontSize: 13 }}>보도 포함</Text></Pressable> : null}<View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}><Search color={theme.muted} size={16} /><TextInput accessibilityLabel="선수 검색" placeholder="선수 검색" placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} style={{ flex: 1, padding: 0, color: theme.ink, ...fonts.medium, fontSize: 13 }} /></View></> : null}
    </View>
    {tab === 'rosters' ? <View style={{ gap: 20 }}>{ordered.filter((roster) => teamFilter === 'all' || teamFilter === roster.team).map((roster) => {
      const team = teams.get(roster.team);
      const departures = departuresForTeam(roster.team, market.snapshot.rosters, allEvents);
      const arrivals = latest.filter((event) => lckTeamCode(event.to) === roster.team && ['transfer', 'loan', 'promote'].includes(event.kind) && (event.kind === 'promote' || lckTeamCode(event.from) !== roster.team) && roster.slots.some((slot) => slot.next.some((person) => normalizeTransferName(person.name) === normalizeTransferName(event.player))));
      const arrivalNames = new Set(arrivals.map((event) => normalizeTransferName(event.player)));
      return <View key={roster.team} style={[styles.roster, { backgroundColor: theme.border }]}><View style={{ backgroundColor: colorScheme === 'dark' ? theme.card : theme.surface }}><View style={[styles.rosterHeader, { backgroundColor: theme.card, borderBottomColor: theme.divider }]}><TeamLogo plain size={28} team={team} themeAware /><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 16, lineHeight: 20 }}>{roster.team === 'DNS' ? 'DN SOOPers' : team?.name ?? roster.team}</Text></View>
        {[...roster.slots.filter((slot) => slot.role !== 'COACH'), ...roster.slots.filter((slot) => slot.role === 'COACH')].map((slot, index) => <View key={slot.role} style={[styles.slot, { borderBottomColor: theme.divider, borderBottomWidth: colorScheme === 'dark' ? 0 : 1, backgroundColor: colorScheme === 'dark' && index % 2 === 0 ? theme.cardHover : undefined }]}><RoleIcon role={slot.role} /><View style={styles.flex}>{slot.previous.map((person) => <View key={person.name}>{playerName(person.name, true)}</View>)}</View>{arrow()}<View style={[styles.flex, { alignItems: 'flex-end' }]}>{slot.next.length ? slot.next.map((person) => <View key={person.name} style={styles.teamName}>{arrivalNames.has(normalizeTransferName(person.name)) ? <Text style={{ color: theme.accent, ...fonts.medium, fontSize: 13 }}>합류</Text> : null}{playerName(person.name)}</View>) : <Text accessibilityLabel="미발표" style={{ color: theme.muted, ...fonts.medium, fontSize: 16 }}>—</Text>}</View></View>)}
      </View><View style={{ flexDirection: 'row', gap: 1 }}>{movementSummary('합류', arrivals, true, roster.team)}{movementSummary('이탈', departures, false, roster.team)}</View></View>;
    })}</View> : <View>
      {visibleEvents.length ? visibleEvents.map((event) => <View key={event.id} accessibilityLabel={`${event.player} ${TRANSFER_KIND_LABELS[event.kind]} ${event.from || '이전 팀 미정'}에서 ${destination(event)}${event.date ? `, ${event.date}` : ''}`} style={[styles.eventRow, { borderBottomColor: theme.divider }]}><View style={{ maxWidth: 100 }}>{playerName(event.player, false, event)}</View><Text style={[styles.badge, { backgroundColor: theme.card, color: theme.ink, ...fonts.medium }]}>{TRANSFER_KIND_LABELS[event.kind]}</Text><View style={[styles.teamName, styles.flex]}>{teamName(event.from || '미정', true, width - 32 < 480)}{event.kind !== 'renew' ? <>{arrow()}{teamName(destination(event), true, width - 32 < 480)}</> : null}</View><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{event.contractUntil?.replaceAll('-', '.')}</Text></View>) : <Text style={[styles.empty, { backgroundColor: theme.card, color: theme.muted, ...fonts.regular }]}>{tab === 'fa' ? '확인된 FA 선수가 없습니다.' : '조건에 맞는 변동 소식이 없습니다.'}</Text>}
      {tab === 'fa' ? <View style={{ marginTop: 32 }}><Text style={{ color: theme.ink, ...fonts.display, fontSize: 20, marginBottom: 12 }}>계약 종료 예정</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 24, marginBottom: 16 }}>실제 계약 종료가 발표되기 전까지는 FA로 분류하지 않습니다.</Text><View style={{ gap: 8 }}>{market.snapshot.faCandidates.filter((person) => (teamFilter === 'all' || person.team === teamFilter) && (role === 'all' || role === person.role) && (!keyword || normalizeTransferName(person.player).includes(keyword)) && !latest.some((event) => normalizeTransferName(event.player) === normalizeTransferName(person.player))).map((person) => <View key={`${person.team}:${person.player}`} style={[styles.candidate, { backgroundColor: theme.card }]}><RoleIcon role={person.role} />{playerName(person.player)}<View style={{ marginLeft: 'auto' }}>{teamName(person.team, true)}</View></View>)}</View></View> : null}
    </View>}
    {tab !== 'rosters' ? <Text style={{ marginTop: 20, color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>확인 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(market.checked_at))}</Text> : null}
  </View>;
}

function TransferLoading() {
  const { theme } = useMinionTheme();
  return <View accessibilityRole="progressbar" accessibilityLabel="이적시장 불러오는 중" style={{ gap: 16 }}><View style={{ height: 44, borderRadius: 8, backgroundColor: theme.card }} /><View style={{ height: 36, width: 280, borderRadius: 8, backgroundColor: theme.card }} /><View style={{ height: 32, width: 140, borderRadius: 6, backgroundColor: theme.card }} />{[0, 1].map((key) => <View key={key} style={[styles.roster, { backgroundColor: theme.border }]}><View style={{ height: 48, backgroundColor: theme.card }} />{TRANSFER_ROLES.map((role) => <View key={role} style={{ height: 56, backgroundColor: theme.surface }} />)}<View style={{ flexDirection: 'row', gap: 1 }}>{[0, 1].map((column) => <View key={column} style={{ height: 104, flex: 1, backgroundColor: theme.card }} />)}</View></View>)}</View>;
}

const styles = StyleSheet.create({
  content: { gap: 0, paddingTop: 4, paddingBottom: 64 }, title: { marginBottom: 12 },
  mb16: { marginBottom: 16 }, flex: { flex: 1, minWidth: 0 }, teamName: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  recent: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, minHeight: 44, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 8, padding: 3, gap: 2, marginBottom: 16 }, tab: { height: 32, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: 'transparent', borderRadius: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, search: { width: '100%', height: 32, borderWidth: 1, borderRadius: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  roster: { borderRadius: 6, padding: 1, gap: 1, overflow: 'hidden' }, rosterHeader: { flexDirection: 'row', alignItems: 'center', height: 48, gap: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 12, paddingVertical: 6 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 8, paddingVertical: 6 },
  eventRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1 },
  empty: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 40, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12 },
});
