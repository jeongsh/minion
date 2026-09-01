import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchHeader, MobileMatchSummary } from '@/lib/api-client';

function scoreLabel(score: number | null) {
  return score ?? '-';
}

function CompactTeamBlock({ align, team, teamName }: { align: 'left' | 'right'; team: MobileMatchSummary['teamA']; teamName: string }) {
  const { fonts, theme } = useMinionTheme();
  const isRight = align === 'right';
  const nameBlock = (
    <View style={[styles.nameBlock, { alignItems: isRight ? 'flex-start' : 'flex-end' }]}>
      <Text numberOfLines={1} style={[styles.teamName, { color: theme.ink, ...fonts.black, textAlign: isRight ? 'left' : 'right' }]}>{teamName}</Text>
    </View>
  );
  const logo = <TeamLogo plain size={36} team={team} themeAware />;

  return (
    <View style={[styles.teamBlock, { justifyContent: isRight ? 'flex-start' : 'flex-end' }]}>
      {isRight ? (
        <>
          {logo}
          {nameBlock}
        </>
      ) : (
        <>
          {nameBlock}
          {logo}
        </>
      )}
    </View>
  );
}

function PlayerHighlight({ label, player }: { label: string; player: MobileMatchHeader['pomPlayer'] }) {
  const { fonts, theme } = useMinionTheme();
  const uri = player?.profileImage?.url;
  return (
    <View style={[styles.pomChip, { backgroundColor: theme.surface }]}>
      <View style={[styles.pomAvatar, { backgroundColor: theme.surfaceMuted }]}>
        {uri ? (
          <Image contentFit="cover" source={{ uri }} style={styles.pomAvatarImage} />
        ) : (
          <Text style={[styles.pomAvatarFallback, { color: theme.muted, ...fonts.medium }]}>{player?.name?.slice(0, 2) ?? '-'}</Text>
        )}
      </View>
      <Text style={[styles.pomLabel, { color: theme.muted, ...fonts.medium }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.pomName, { color: theme.ink, ...fonts.medium }]}>{player?.name ?? '집계 전'}</Text>
    </View>
  );
}

export function MatchHeader({ header, match }: { header: MobileMatchHeader; match: MobileMatchSummary }) {
  const { fonts, theme } = useMinionTheme();
  const teamAResult: 'WIN' | 'LOSS' | null = match.winnerTeamId ? (match.winnerTeamId === match.teamA?.id ? 'WIN' : 'LOSS') : null;
  const teamBResult: 'WIN' | 'LOSS' | null = match.winnerTeamId ? (match.winnerTeamId === match.teamB?.id ? 'WIN' : 'LOSS') : null;
  const hasScore = match.teamAScore !== null || match.teamBScore !== null;
  const dateLabel = formatDateTime(match.startsAt);

  return (
    <View style={styles.root}>
      <View style={styles.metaRow}>
        <Text numberOfLines={1} style={[styles.tournamentName, { color: theme.ink, ...fonts.medium }]}>{header.tournamentName}</Text>
        {header.pomPlayer ? (
          <PlayerHighlight label="POM" player={header.pomPlayer} />
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: theme.ink }]}>
            <Text style={[styles.statusBadgeText, { color: theme.surface, ...fonts.medium }]}>{header.statusLabel}</Text>
          </View>
        )}
        <Text numberOfLines={1} style={[styles.stageLabel, { color: theme.muted, ...fonts.medium }]}>
          {header.stageName} · BO{header.bestOf ?? '-'}
        </Text>
      </View>

      <View style={styles.scoreRow}>
        <CompactTeamBlock align="left" team={match.teamA} teamName={match.teamA?.shortName ?? match.teamA?.name ?? '-'} />

        <View style={styles.scoreCenter}>
          {hasScore ? (
            <>
              <View style={[styles.scoreBox, { backgroundColor: theme.ink }]}>
                <Text style={[styles.scoreNumber, { color: theme.surface, ...fonts.black, opacity: teamAResult === 'LOSS' ? 0.45 : 1 }]}>{scoreLabel(match.teamAScore)}</Text>
                <Text style={[styles.scoreColon, { color: theme.surface }]}>:</Text>
                <Text style={[styles.scoreNumber, { color: theme.surface, ...fonts.black, opacity: teamBResult === 'LOSS' ? 0.45 : 1 }]}>{scoreLabel(match.teamBScore)}</Text>
              </View>
              <Text style={[styles.dateLabel, { color: theme.muted, ...fonts.medium }]}>{dateLabel}</Text>
            </>
          ) : (
            <>
              <View style={[styles.vsBox, { backgroundColor: theme.ink }]}>
                <Text style={[styles.vsText, { color: theme.surface, ...fonts.black }]}>VS</Text>
              </View>
              <Text style={[styles.dateLabel, { color: theme.muted, ...fonts.medium }]}>{dateLabel}</Text>
            </>
          )}
        </View>

        <CompactTeamBlock align="right" team={match.teamB} teamName={match.teamB?.shortName ?? match.teamB?.name ?? '-'} />
      </View>
    </View>
  );
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  return formatter.format(date).replace(/\.$/, '');
}

const styles = StyleSheet.create({
  dateLabel: { fontSize: 13, lineHeight: 19.5, marginTop: 4 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  nameBlock: { minWidth: 0 },
  pomAvatar: { alignItems: 'center', borderRadius: 10, height: 20, justifyContent: 'center', overflow: 'hidden', width: 20 },
  pomAvatarFallback: { fontSize: 13, lineHeight: 16 },
  pomAvatarImage: { height: '100%', width: '100%' },
  pomChip: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 6, paddingBottom: 4, paddingLeft: 4, paddingRight: 8, paddingTop: 4 },
  pomLabel: { fontSize: 12, letterSpacing: 0.8, lineHeight: 16 },
  pomName: { flexShrink: 1, fontSize: 13, lineHeight: 19.5 },
  root: { marginHorizontal: -16 },
  scoreBox: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  scoreCenter: { alignItems: 'center', flexShrink: 0, minWidth: 88, paddingHorizontal: 4 },
  scoreColon: { fontSize: 12, opacity: 0.4 },
  scoreNumber: { fontSize: 25, lineHeight: 25 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  stageLabel: { flex: 1, fontSize: 13, lineHeight: 19.5, textAlign: 'right' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 13, lineHeight: 19.5 },
  teamBlock: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  teamName: { fontSize: 16, lineHeight: 20 },
  tournamentName: { flex: 1, fontSize: 13, lineHeight: 19.5 },
  vsBox: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  vsText: { fontSize: 20, lineHeight: 20 },
});
