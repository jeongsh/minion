import { Image } from 'expo-image';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Star from 'lucide-react-native/icons/star';
import ThumbsDown from 'lucide-react-native/icons/thumbs-down';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl, type MobileFanRatingComment, type MobileFanRatingPanel, type MobileFanRatingPlayer } from '@/lib/api-client';

function RatingPlayerRow({ player }: { player: MobileFanRatingPlayer }) {
  const { fonts, theme } = useMinionTheme();
  const profileUrl = resolveApiAssetUrl(player.profileImage?.url);
  return (
    <View accessibilityLabel={`${player.name} ${player.position} 눌러서 평가하기 ${player.averageRating?.toFixed(1) ?? '-'} ${player.ratingCount}명 참여`} style={[styles.playerRow, { backgroundColor: theme.card, opacity: 0.9 }]}>
      <View style={[styles.playerPortrait, { backgroundColor: theme.surfaceMuted }]}>{profileUrl ? <Image contentFit="cover" contentPosition="top" source={{ uri: profileUrl }} style={styles.fill} /> : null}</View>
      <View style={styles.playerIdentity}>
        <View style={styles.playerNameRow}><Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 }}>{player.name}</Text><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 12 }}>{player.position}</Text>{player.isPog ? <View style={styles.pog}><Text style={{ color: '#000000', fontFamily: fonts.regular, fontSize: 12 }}>POG</Text></View> : null}</View>
        <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 }}>눌러서 평가하기</Text>
      </View>
      <View style={styles.ratingSummary}>
        <View style={styles.ratingValue}><Star color={player.averageRating === null ? theme.border : '#fbbf24'} fill={player.averageRating === null ? 'transparent' : '#fbbf24'} size={14} /><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 18 }}>{player.averageRating?.toFixed(1) ?? '-'}</Text></View>
        <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 12 }}>{player.ratingCount}명 참여</Text>
      </View>
    </View>
  );
}

function TeamRatingGroup({ players }: { players: MobileFanRatingPlayer[] }) {
  const { fonts, theme } = useMinionTheme();
  const team = players[0]?.team;
  if (!team) return null;
  return (
    <View style={styles.teamGroup}>
      <View style={styles.teamHeading}><TeamLogo plain size={28} team={team} themeAware /><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 16 }}>{team.shortName}</Text></View>
      <View style={styles.playerList}>{players.map((player) => <RatingPlayerRow key={player.id} player={player} />)}</View>
    </View>
  );
}

function RatingComment({ item }: { item: MobileFanRatingComment }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.comment, { backgroundColor: theme.card }]}>
      <View style={styles.commentHead}>
        <View style={[styles.authorAvatar, { backgroundColor: theme.surfaceMuted }]}>{item.authorImage?.url ? <Image contentFit="cover" source={{ uri: resolveApiAssetUrl(item.authorImage.url) ?? undefined }} style={styles.fill} /> : null}</View>
        <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 14 }}>{item.authorName}</Text>
        <View style={[styles.playerBadge, { backgroundColor: theme.surface }]}>{item.playerImage?.url ? <Image contentFit="cover" contentPosition="top" source={{ uri: resolveApiAssetUrl(item.playerImage.url) ?? undefined }} style={styles.badgeImage} /> : null}<Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 12 }}>{item.playerName}</Text></View>
        <View style={styles.commentScore}><Star color="#fbbf24" fill="#fbbf24" size={14} /><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 15 }}>{item.rating.toFixed(1)}</Text></View>
      </View>
      <Text style={{ color: theme.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, marginTop: 6 }}>{item.review}</Text>
      <View style={styles.commentActions}><View style={styles.commentAction}><ThumbsUp color={theme.muted} size={14} /><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13 }}>좋아요 {item.honorCount}</Text></View><View style={styles.commentAction}><ThumbsDown color={theme.muted} size={14} /><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 13 }}>싫어요 {item.dislikeCount}</Text></View></View>
    </View>
  );
}

export function MatchRatingTab({ panel }: { panel: MobileFanRatingPanel | null }) {
  const { fonts, showToast, theme } = useMinionTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const comments = useMemo(() => playerId ? panel?.comments.filter((item) => item.playerId === playerId) ?? [] : panel?.comments ?? [], [panel, playerId]);
  if (!panel) return <View style={[styles.empty, { borderColor: theme.border }]}><Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 15 }}>투표할 세트가 없습니다.</Text></View>;
  const teams = [...new Set(panel.players.map((player) => player.team?.id).filter(Boolean))];
  const filterPlayers = [...new Map(panel.comments.map((item) => [item.playerId, { id: item.playerId, name: item.playerName }])).values()];
  return (
    <View style={styles.root}>
      <View style={[styles.loginBanner, { backgroundColor: theme.card }]}><Text style={{ color: theme.muted, flex: 1, fontFamily: fonts.regular, fontSize: 14 }}>평점을 남기려면 로그인이 필요합니다.</Text><Pressable onPress={() => showToast('로그인은 인증 화면 구현 단계에서 연결합니다.')} style={[styles.loginButton, { backgroundColor: theme.ink }]}><Text style={{ color: theme.surface, fontFamily: fonts.bold, fontSize: 15 }}>로그인</Text></Pressable></View>
      {teams.map((teamId) => <TeamRatingGroup key={teamId} players={panel.players.filter((player) => player.team?.id === teamId)} />)}
      <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}>{panel.statusNote}</Text>
      <View style={styles.commentsSection}>
        <View style={styles.commentsHead}><Text style={{ color: theme.ink, fontFamily: fonts.black, fontSize: 16 }}>평가 코멘트</Text>{panel.comments.length > 0 ? <Pressable onPress={() => setFilterOpen(true)} style={[styles.filter, { backgroundColor: theme.card }]}><Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.regular, fontSize: 14 }}>{playerId ? `${filterPlayers.find((item) => item.id === playerId)?.name} (${comments.length})` : `전체 선수 (${panel.comments.length})`}</Text><ChevronDown color={theme.muted} size={16} /></Pressable> : null}</View>
        {comments.length === 0 ? <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 14, marginTop: 8 }}>아직 작성된 평가 코멘트가 없습니다.</Text> : <View style={styles.commentList}>{comments.map((item) => <RatingComment item={item} key={item.id} />)}</View>}
      </View>
      <BottomSheet onClose={() => setFilterOpen(false)} open={filterOpen} title="선수별 코멘트 필터"><View style={styles.filterList}><Pressable onPress={() => { setPlayerId(null); setFilterOpen(false); }} style={styles.filterItem}><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 16 }}>전체 선수 ({panel.comments.length})</Text></Pressable>{filterPlayers.map((player) => <Pressable key={player.id} onPress={() => { setPlayerId(player.id); setFilterOpen(false); }} style={styles.filterItem}><Text style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 16 }}>{player.name} ({panel.comments.filter((item) => item.playerId === player.id).length})</Text></Pressable>)}</View></BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  authorAvatar: { borderRadius: 14, height: 28, overflow: 'hidden', width: 28 },
  badgeImage: { borderRadius: 14, height: 28, width: 28 },
  comment: { borderRadius: 12, padding: 14 },
  commentAction: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  commentActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  commentHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  commentList: { gap: 12, marginTop: 8 },
  commentScore: { alignItems: 'center', flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  commentsHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  commentsSection: { marginTop: 12 },
  empty: { borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, padding: 16 },
  fill: { height: '100%', width: '100%' },
  filter: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 36, maxWidth: '55%', paddingHorizontal: 12 },
  filterItem: { justifyContent: 'center', minHeight: 48 },
  filterList: { paddingBottom: 8 },
  loginBanner: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  loginButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  playerIdentity: { flex: 1, gap: 4, minWidth: 0 },
  playerList: { gap: 8 },
  playerNameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  playerPortrait: { alignSelf: 'stretch', overflow: 'hidden', width: 64 },
  playerRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', height: 76, overflow: 'hidden', paddingRight: 12 },
  playerGroup: { gap: 8 },
  playerRating: { alignItems: 'flex-end' },
  pog: { backgroundColor: '#fbbf24', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  ratingSummary: { alignItems: 'flex-end' },
  ratingValue: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  root: { gap: 16 },
  teamGroup: { gap: 8 },
  teamHeading: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  playerBadge: { alignItems: 'center', borderRadius: 4, flexDirection: 'row', gap: 6, paddingRight: 6 },
});
