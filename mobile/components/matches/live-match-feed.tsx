import { Image } from 'expo-image';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Sword from 'lucide-react-native/icons/sword';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { ObjectiveIcon } from '@/components/matches/objective-icon';
import { OBJECTIVE_ICON_PATHS } from '@/constants/objective-icons';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { fetchMobileApi, type MobileTeamSummary } from '@/lib/api-client';

type LiveEvent = { id: string; time: number; type: 'kill' | 'tower' | 'baron' | 'inhibitor' | 'dragon' | 'end'; teamId: string | null; killerSummonerName: string | null; killerChampionId: string | null; victimSummonerName: string | null; victimChampionId: string | null; dragonType: string | null };
type LiveResponse = { status: 'not_found' | 'unavailable' | 'not_started' | 'ended' | 'live'; events?: LiveEvent[]; durationSeconds?: number | null };

function clock(seconds: number | null | undefined) {
  if (seconds == null) return '-:--';
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function statusText(status: LiveResponse['status'] | 'loading') {
  if (status === 'loading') return '불러오는 중...';
  if (status === 'not_started') return '경기 시작 전입니다';
  if (status === 'ended') return '게임이 진행 중이지 않습니다';
  return '실시간 데이터를 가져올 수 없습니다';
}

function eventLabel(event: LiveEvent) {
  if (event.type === 'tower') return '타워';
  if (event.type === 'baron') return '바론';
  if (event.type === 'inhibitor') return '억제기';
  if (event.type === 'dragon') return event.dragonType ? `${event.dragonType} 드래곤` : '드래곤';
  if (event.type === 'end') return '경기 종료';
  return event.victimSummonerName ?? '?';
}

function ChampionAvatar({ championId, defeated, name }: { championId: string | null; defeated?: boolean; name: string | null }) {
  const { fonts, theme } = useMinionTheme();
  const uri = championId ? `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${championId}_0.jpg` : null;
  return <View style={[styles.avatar, { backgroundColor: theme.cardHover }]}>{uri ? <Image contentFit="cover" source={{ uri }} style={[styles.fill, defeated && { opacity: 0.55 }]} /> : <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 12 }}>{name?.slice(0, 1) ?? '?'}</Text>}</View>;
}

function Participant({ championId, defeated, name, reverse }: { championId: string | null; defeated?: boolean; name: string | null; reverse?: boolean }) {
  const { fonts, theme } = useMinionTheme();
  return <View style={[styles.participant, reverse && styles.participantReverse]}><ChampionAvatar championId={championId} defeated={defeated} name={name} /><Text numberOfLines={1} style={{ color: theme.ink, flex: 1, fontFamily: fonts.bold, fontSize: 13, textAlign: reverse ? 'right' : 'left' }}>{name ?? '?'}</Text></View>;
}

function objectivePath(type: LiveEvent['type']) {
  if (type === 'tower' || type === 'inhibitor') return OBJECTIVE_ICON_PATHS.tower;
  if (type === 'baron') return OBJECTIVE_ICON_PATHS.baron;
  return OBJECTIVE_ICON_PATHS.dragon;
}

function EventContent({ event, teamA, teamB }: { event: LiveEvent; teamA: MobileTeamSummary | null; teamB: MobileTeamSummary | null }) {
  const { fonts, theme } = useMinionTheme();
  if (event.type === 'end') return <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 14 }}>경기 종료</Text>;
  if (event.type === 'kill') return <View style={styles.eventPair}><Participant championId={event.killerChampionId} name={event.killerSummonerName} reverse /><Sword color={theme.muted} size={20} /><Participant championId={event.victimChampionId} defeated name={event.victimSummonerName} /></View>;
  const team = event.teamId === teamA?.id ? teamA : event.teamId === teamB?.id ? teamB : null;
  return <View style={styles.eventPair}><View style={styles.eventTeam}><View style={[styles.avatar, { backgroundColor: theme.surface }]}><TeamLogo plain size={28} team={team} themeAware /></View><Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>{team?.shortName ?? '?'}</Text></View><Sword color={theme.muted} size={20} /><View style={styles.objective}><View style={[styles.avatar, { backgroundColor: theme.surface }]}><ObjectiveIcon path={objectivePath(event.type)} size={28} /></View><Text numberOfLines={1} style={{ color: theme.ink, flex: 1, fontFamily: fonts.bold, fontSize: 13 }}>{eventLabel(event)}</Text></View></View>;
}

export function LiveMatchFeed({ matchId, teamA, teamB }: { matchId: string; teamA: MobileTeamSummary | null; teamB: MobileTeamSummary | null }) {
  const { fonts, theme } = useMinionTheme();
  const [data, setData] = useState<LiveResponse>({ status: 'unavailable' });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchMobileApi<LiveResponse>(`/api/mobile/v1/matches/${encodeURIComponent(matchId)}/live`)); }
    catch { setData({ status: 'unavailable' }); }
    finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, 10_000);
    return () => clearInterval(timer);
  }, [load]);
  const status = loading && !data.events ? 'loading' : data.status;
  const events = data.events ?? [];
  return (
    <View accessibilityLabel="실시간 경기 피드">
      <View style={styles.header}>
        {status === 'live' ? <View style={styles.liveLabel}><View style={[styles.liveDot, { backgroundColor: theme.accent }]} /><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 13 }}>LIVE</Text></View> : <Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13 }}>{statusText(status)}</Text>}
        <View style={styles.headerActions}>{status === 'live' ? <Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13 }}>{clock(data.durationSeconds)}</Text> : null}<Pressable accessibilityLabel="새로고침" disabled={loading} onPress={() => void load()} style={styles.refresh}><RefreshCw color={theme.muted} size={16} /></Pressable></View>
      </View>
      {events.length === 0 ? <View style={[styles.empty, { backgroundColor: theme.card }]}><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13 }}>{status === 'live' ? '곧 새 소식이 올라옵니다...' : '아직 표시할 이벤트가 없습니다.'}</Text></View> : <View style={styles.timeline}>{events.map((event, index) => <View key={event.id} style={[styles.eventRow, { backgroundColor: theme.card }]}><View style={[styles.timelineDot, { backgroundColor: theme.accent }, index === 0 && { borderColor: theme.surface, borderWidth: 2 }]} /><Text style={{ color: theme.muted, fontFamily: fonts.bold, fontSize: 13, width: 52 }}>{clock(event.time)}</Text><EventContent event={event} teamA={teamA} teamB={teamB} /></View>)}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 6, height: 36, justifyContent: 'center', overflow: 'hidden', width: 36 },
  empty: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 40 },
  eventPair: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minWidth: 0 },
  eventRow: { alignItems: 'center', borderRadius: 6, flexDirection: 'row', gap: 8, minHeight: 60, paddingHorizontal: 12, paddingVertical: 8, position: 'relative' },
  eventTeam: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', minWidth: 0 },
  fill: { height: '100%', width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, minHeight: 32, paddingHorizontal: 4 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  liveDot: { borderRadius: 4, height: 8, width: 8 },
  liveLabel: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  objective: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6, minWidth: 0 },
  participant: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  participantReverse: { flexDirection: 'row-reverse' },
  refresh: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  timeline: { borderLeftWidth: 1, gap: 4, marginLeft: 6, paddingLeft: 20 },
  timelineDot: { borderRadius: 7, height: 10, left: -25.5, position: 'absolute', top: 25, width: 10 },
});
