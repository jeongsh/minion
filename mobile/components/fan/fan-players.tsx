import { StyleSheet, View } from 'react-native';

import { FanEmpty, FanPlayerCard, FAN_POSITION_ORDER } from '@/components/fan/fan-shared';
import type { MobilePlayerDirectoryItem, MobileTeamSummary } from '@/lib/api-client';

export function FanPlayers({ players, team }: { players: MobilePlayerDirectoryItem[]; team: MobileTeamSummary }) {
  const sorted = [...players].sort((a, b) => {
    if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
    const position = FAN_POSITION_ORDER.indexOf(a.position ?? '') - FAN_POSITION_ORDER.indexOf(b.position ?? '');
    return position || a.name.localeCompare(b.name, 'ko');
  });
  return (
    <View style={styles.page}>
      {sorted.length ? (
        <View accessibilityLabel={`${team.shortName} 선수단`} style={styles.grid}>
          {sorted.map((player) => <FanPlayerCard href={`/players/${player.slug}`} key={player.id} player={player} teamName={team.shortName} />)}
        </View>
      ) : <FanEmpty>등록된 선수가 없습니다.</FanEmpty>}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  page: { paddingHorizontal: 16, paddingVertical: 20 },
});
