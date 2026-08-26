import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';
import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobilePlayerDirectoryItem, type MobilePlayersDto, type MobileTeamSummary } from '@/lib/api-client';

const POSITIONS = ['TOP', 'JGL', 'MID', 'BOT', 'SUP'] as const;
const POS_ORDER = ['TOP', 'JGL', 'MID', 'BOT', 'SUP'];
type Division = 'first' | 'challengers';

function DirectorySkeleton() {
  const { theme } = useMinionTheme();
  return (
    <View accessibilityLabel="선수 목록을 불러오는 중입니다" style={styles.page}>
      <View style={[styles.divisionShell, { backgroundColor: theme.card }]}>
        <View style={[styles.skeletonDivision, { backgroundColor: theme.surfaceMuted }]} />
        <View style={[styles.skeletonDivision, { backgroundColor: theme.surfaceMuted }]} />
      </View>
      <View style={styles.mobileFilterRow}>
        <View style={[styles.skeletonCount, { backgroundColor: theme.surfaceMuted }]} />
        <View style={[styles.skeletonFilter, { backgroundColor: theme.surfaceMuted }]} />
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 10 }, (_, index) => (
          <View key={index} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={[styles.cardImage, { backgroundColor: theme.card }]} />
            <View style={styles.cardBody}>
              <View style={[styles.skeletonName, { backgroundColor: theme.surfaceMuted }]} />
              <View style={[styles.skeletonMeta, { backgroundColor: theme.surfaceMuted }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlayerCard({ player, team }: { player: MobilePlayerDirectoryItem; team?: MobileTeamSummary }) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const imageUrl = resolveApiAssetUrl(player.profileImage?.url);
  const meta = `${team?.shortName ?? 'FA'}${player.realName ? ` · ${player.realName}` : ''}`;

  return (
    <Pressable
      accessibilityLabel={`${player.name} ${player.position ?? ''} ${meta}`}
      accessibilityRole="link"
      onPress={() => router.push(`/players/${player.slug}`)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.82 : 1 }]}
    >
      <View style={[styles.cardImage, { backgroundColor: theme.card }]}>
        {imageUrl ? (
          <Image accessibilityLabel={player.name} contentFit="cover" contentPosition="top" source={imageUrl} style={StyleSheet.absoluteFill} transition={120} />
        ) : (
          <View style={styles.fallback}><Text style={{ color: theme.muted, fontFamily: fonts.black, fontSize: 18 }}>{player.name.slice(0, 2)}</Text></View>
        )}
        <View style={styles.positionBadge}>
          <Text style={{ color: '#ffffff', fontFamily: fonts.medium, fontSize: 11, lineHeight: 16.5 }}>{player.position}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 16, lineHeight: 24 }}>{player.name}</Text>
        <Text numberOfLines={1} style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13, lineHeight: 19.5, marginTop: 2 }}>{meta}</Text>
      </View>
    </Pressable>
  );
}

function FilterButton({ active, children, onPress, team = false }: { active: boolean; children: React.ReactNode; onPress: () => void; team?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <Pressable onPress={onPress} style={[team ? styles.teamFilter : styles.positionFilter, { backgroundColor: active ? theme.ink : team ? 'transparent' : theme.card }]}>
      <Text numberOfLines={1} style={{ color: active ? theme.surface : theme.muted, fontFamily: fonts.black, fontSize: team ? 14 : 13 }}>{children}</Text>
    </Pressable>
  );
}

function PlayerFilters({ position, setPosition, setTeamId, teamId, teams }: {
  position: string;
  setPosition: (value: string) => void;
  setTeamId: (value: string) => void;
  teamId: string;
  teams: MobileTeamSummary[];
}) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={styles.filters}>
      <View>
        <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, lineHeight: 18, marginBottom: 8 }}>포지션</Text>
        <View style={styles.positionGrid}>
          {['all', ...POSITIONS].map((item) => <FilterButton active={position === item} key={item} onPress={() => setPosition(item)}>{item === 'all' ? '전체' : item}</FilterButton>)}
        </View>
      </View>
      <View>
        <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, lineHeight: 18, marginBottom: 8 }}>팀</Text>
        <View style={styles.teamGrid}>
          <FilterButton active={teamId === 'all'} onPress={() => setTeamId('all')} team>전체 팀</FilterButton>
          {teams.map((team) => (
            <Pressable key={team.id} onPress={() => setTeamId(team.id)} style={[styles.teamFilter, { backgroundColor: teamId === team.id ? theme.ink : 'transparent' }]}>
              {team.logo?.url ? <Image accessibilityLabel={team.name} contentFit="contain" source={resolveApiAssetUrl(team.logo.url)} style={styles.teamLogo} /> : null}
              <Text numberOfLines={1} style={{ color: teamId === team.id ? theme.surface : theme.ink, flex: 1, fontFamily: fonts.bold, fontSize: 14 }}>{team.shortName}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function FilterSheet({ children, onClose, open }: { children: React.ReactNode; onClose: () => void; open: boolean }) {
  return <BottomSheet contentStyle={styles.modalBody} maxHeight="92%" onClose={onClose} open={open} scrollable title="선수 필터">{children}</BottomSheet>;
}

export function PlayerDirectory() {
  const { data, error, loading, refresh } = useCachedQuery<MobilePlayersDto>('/api/mobile/v1/players');
  const { fonts, theme } = useMinionTheme();
  const [division, setDivision] = useState<Division>('first');
  const [teamId, setTeamId] = useState('all');
  const [position, setPosition] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const sourcePlayers = useMemo(() => division === 'first' ? data?.items ?? [] : data?.challengersItems ?? [], [data, division]);
  const teams = useMemo(() => data?.teams ?? [], [data]);
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const visible = useMemo(() => sourcePlayers.filter((player) => (teamId === 'all' || player.teamId === teamId) && (position === 'all' || player.position === position)), [position, sourcePlayers, teamId]);
  const sortedVisible = useMemo(() => {
    const teamRank = new Map(teams.map((team, index) => [team.id, index]));
    return [...visible].sort((a, b) => {
      const rankA = a.teamId ? (teamRank.get(a.teamId) ?? teams.length) : teams.length;
      const rankB = b.teamId ? (teamRank.get(b.teamId) ?? teams.length) : teams.length;
      if (rankA !== rankB) return rankA - rankB;
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      if (a.position !== b.position) return POS_ORDER.indexOf(a.position ?? '') - POS_ORDER.indexOf(b.position ?? '');
      return a.name.localeCompare(b.name);
    });
  }, [teams, visible]);

  if (loading && !data) return <MinionScreen><DirectorySkeleton /></MinionScreen>;
  if (error && !data) return <MinionScreen><ErrorState onRetry={refresh} title={error} /></MinionScreen>;

  const filters = <PlayerFilters position={position} setPosition={setPosition} setTeamId={setTeamId} teamId={teamId} teams={teams} />;
  return (
    <MinionScreen>
      <View style={styles.page}>
        <View style={[styles.divisionShell, { backgroundColor: theme.card }]}>
          {([['first', '1군'], ['challengers', '2군']] as const).map(([value, label]) => {
            const active = division === value;
            return <Pressable key={value} onPress={() => setDivision(value)} style={[styles.divisionButton, { backgroundColor: active ? theme.ink : 'transparent' }]}><Text style={{ color: active ? theme.surface : theme.muted, fontFamily: fonts.black, fontSize: 14, lineHeight: 20 }}>{label}</Text></Pressable>;
          })}
        </View>
        <View style={styles.mobileFilterRow}>
          <Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 }}>{visible.length}명</Text>
          <Pressable onPress={() => setFilterOpen(true)} style={[styles.filterTrigger, { borderColor: theme.border }]}>
            <SlidersHorizontal color={theme.ink} size={18} />
            <Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 14, lineHeight: 20 }}>필터</Text>
          </Pressable>
        </View>
        {sortedVisible.length ? (
          <View accessibilityLabel="선수 목록" style={styles.grid}>{sortedVisible.map((player) => <PlayerCard key={player.id} player={player} team={player.teamId ? teamMap.get(player.teamId) : undefined} />)}</View>
        ) : (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Image contentFit="contain" source={require('@/assets/characters/pen-4.png')} style={styles.emptyImage} />
            <Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 17 }}>이 조합엔 선수가 숨어있어요</Text>
            <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, marginTop: 6 }}>팀이나 포지션 필터를 살짝 바꿔보세요.</Text>
          </View>
        )}
      </View>
      <FilterSheet onClose={() => setFilterOpen(false)} open={filterOpen}>{filters}</FilterSheet>
    </MinionScreen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 8 },
  divisionShell: { alignSelf: 'flex-start', borderRadius: 12, flexDirection: 'row', padding: 4 },
  divisionButton: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 36, paddingHorizontal: 16, paddingVertical: 8 },
  mobileFilterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, marginTop: 16, minHeight: 44 },
  filterTrigger: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', width: '48.6%' },
  cardImage: { aspectRatio: 4 / 5, overflow: 'hidden', position: 'relative', width: '100%' },
  fallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  positionBadge: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 8 },
  cardBody: { padding: 12 },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, minHeight: 160, paddingHorizontal: 20, paddingVertical: 40 },
  emptyImage: { height: 80, width: 80 },
  filters: { gap: 20 },
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  positionFilter: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 40, width: '31.7%' },
  teamGrid: { gap: 6 },
  teamFilter: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 12 },
  teamLogo: { height: 28, width: 28 },
  modalBody: { padding: 16 },
  skeletonDivision: { borderRadius: 8, height: 36, width: 58 },
  skeletonCount: { borderRadius: 4, height: 14, width: 40 },
  skeletonFilter: { borderRadius: 12, height: 44, width: 76 },
  skeletonName: { borderRadius: 4, height: 16, width: '60%' },
  skeletonMeta: { borderRadius: 4, height: 13, marginTop: 8, width: '80%' },
});
