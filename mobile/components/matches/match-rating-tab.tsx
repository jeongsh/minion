import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Star from 'lucide-react-native/icons/star';
import ThumbsDown from 'lucide-react-native/icons/thumbs-down';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { invalidateApiCache, mutateMobileApi, resolveApiAssetUrl, type MobileFanRatingComment, type MobileFanRatingMutationDto, type MobileFanRatingPanel, type MobileFanRatingPlayer } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

const MAX_REVIEW_LENGTH = 240;

function RatingPlayerRow({ disabled, myRating, onSelect, player, selected }: { disabled: boolean; myRating: number | null; onSelect: () => void; player: MobileFanRatingPlayer; selected: boolean }) {
  const { fonts, theme } = useMinionTheme();
  const profileUrl = resolveApiAssetUrl(player.profileImage?.url);
  return (
    <Pressable
      accessibilityLabel={`${player.name} ${player.position ?? ''} ${myRating == null ? '눌러서 평가하기' : `내 평점 ${myRating.toFixed(1)}`} 평균 ${player.averageRating?.toFixed(1) ?? '-'} ${player.ratingCount}명 참여`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [styles.playerRow, { backgroundColor: selected && player.team?.primaryColor ? `${player.team.primaryColor}1f` : theme.card, opacity: disabled ? 0.9 : pressed ? 0.78 : 1 }]}>
      <View style={[styles.playerPortrait, { backgroundColor: theme.surfaceMuted }]}>
        {profileUrl ? <Image accessibilityLabel="" contentFit="cover" contentPosition="top" source={{ uri: profileUrl }} style={styles.fill} /> : <Text style={{ color: theme.muted, ...fonts.black, fontSize: 20 }}>{player.name.trim().slice(0, 1).toUpperCase() || '-'}</Text>}
      </View>
      <View style={styles.playerIdentity}>
        <View style={styles.playerNameRow}>
          <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 20 }}>{player.name}</Text>
          <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{player.position}</Text>
          {player.isPog ? <View style={styles.pog}><Text style={{ color: '#000000', ...fonts.regular, fontSize: 12 }}>POG</Text></View> : null}
        </View>
        <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 17 }}>{myRating == null ? '눌러서 평가하기' : `내 평점 ${myRating.toFixed(1)}`}</Text>
      </View>
      <View style={styles.ratingSummary}>
        <View style={styles.ratingValue}><Star color={player.averageRating === null ? theme.border : '#fbbf24'} fill={player.averageRating === null ? 'transparent' : '#fbbf24'} size={14} /><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 18 }}>{player.averageRating?.toFixed(1) ?? '-'}</Text></View>
        <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{player.ratingCount}명 참여</Text>
      </View>
    </Pressable>
  );
}

function TeamRatingGroup({ disabled, localRatings, onSelect, players, selectedPlayerId }: { disabled: boolean; localRatings: Record<string, number>; onSelect: (player: MobileFanRatingPlayer) => void; players: MobileFanRatingPlayer[]; selectedPlayerId: string | null }) {
  const { fonts, theme } = useMinionTheme();
  const team = players[0]?.team;
  if (!team) return null;
  return (
    <View style={styles.teamGroup}>
      <View style={styles.teamHeading}><TeamLogo plain size={28} team={team} themeAware /><Text style={{ color: theme.ink, ...fonts.black, fontSize: 18 }}>{team.shortName}</Text></View>
      <View style={styles.playerList}>{players.map((player) => <RatingPlayerRow disabled={disabled} key={player.id} myRating={localRatings[player.id] ?? player.myRating} onSelect={() => onSelect(player)} player={player} selected={selectedPlayerId === player.id} />)}</View>
    </View>
  );
}

function RatingComment({ item }: { item: MobileFanRatingComment }) {
  const { fonts, theme } = useMinionTheme();
  return (
    <View style={[styles.comment, { backgroundColor: theme.card }]}>
      <View style={styles.commentHead}>
        <View style={[styles.authorAvatar, { backgroundColor: theme.surfaceMuted }]}>{item.authorImage?.url ? <Image accessibilityLabel="" contentFit="cover" source={{ uri: resolveApiAssetUrl(item.authorImage.url) ?? undefined }} style={styles.fill} /> : null}</View>
        <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{item.authorName}</Text>
        <View style={[styles.playerBadge, { backgroundColor: theme.surface }]}>{item.playerImage?.url ? <Image accessibilityLabel="" contentFit="cover" contentPosition="top" source={{ uri: resolveApiAssetUrl(item.playerImage.url) ?? undefined }} style={styles.badgeImage} /> : null}<Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{item.playerName}</Text></View>
        <View style={styles.commentScore}><Star color="#fbbf24" fill="#fbbf24" size={14} /><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15 }}>{item.rating.toFixed(1)}</Text></View>
      </View>
      <Text style={{ color: theme.text, ...fonts.regular, fontSize: 14, lineHeight: 22, marginTop: 6 }}>{item.review}</Text>
      <View style={styles.commentActions}><View style={styles.commentAction}><ThumbsUp color={theme.muted} size={14} /><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>좋아요 {item.honorCount}</Text></View><View style={styles.commentAction}><ThumbsDown color={theme.muted} size={14} /><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>싫어요 {item.dislikeCount}</Text></View></View>
    </View>
  );
}

function StarRatingPicker({ disabled, onChange, value }: { disabled: boolean; onChange: (value: number) => void; value: number | null }) {
  const { fonts, theme } = useMinionTheme();
  const current = value ?? 0;
  return (
    <View accessibilityLabel="평점 선택" accessibilityRole="radiogroup" style={styles.starPicker}>
      <View style={styles.starList}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fillWidth = current >= star ? 20 : current >= star - 0.5 ? 10 : 0;
          return (
            <View key={star} style={styles.starSlot}>
              <Star color={theme.border} size={20} />
              {fillWidth > 0 ? <View pointerEvents="none" style={[styles.starFillClip, { width: fillWidth }]}><Star color="#fbbf24" fill="#fbbf24" size={20} /></View> : null}
              <Pressable accessibilityLabel={`${(star - 0.5).toFixed(1)}점`} accessibilityRole="radio" accessibilityState={{ checked: value === star - 0.5, disabled }} disabled={disabled} hitSlop={{ bottom: 10, top: 10 }} onPress={() => onChange(star - 0.5)} style={styles.leftHalf} />
              <Pressable accessibilityLabel={`${star.toFixed(1)}점`} accessibilityRole="radio" accessibilityState={{ checked: value === star, disabled }} disabled={disabled} hitSlop={{ bottom: 10, top: 10 }} onPress={() => onChange(star)} style={styles.rightHalf} />
            </View>
          );
        })}
      </View>
      <View style={styles.selectedValue}><Text style={{ color: theme.ink, ...fonts.bold, fontSize: 15 }}>{value == null ? '-' : value.toFixed(1)}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14 }}>/ 5</Text></View>
    </View>
  );
}

export function MatchRatingTab({ matchId, panel, setId }: { matchId: string; panel: MobileFanRatingPanel | null; setId: string }) {
  const router = useRouter();
  const { loading: authLoading, session } = useAuth();
  const { fonts, showToast, theme } = useMinionTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<MobileFanRatingPlayer | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});
  const comments = useMemo(() => playerId ? panel?.comments.filter((item) => item.playerId === playerId) ?? [] : panel?.comments ?? [], [panel, playerId]);
  if (!panel) return <View style={[styles.empty, { borderColor: theme.border }]}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22 }}>투표할 세트가 없습니다.</Text></View>;
  const teams = [...new Set(panel.players.map((player) => player.team?.id).filter(Boolean))];
  const filterPlayers = [...new Map(panel.comments.map((item) => [item.playerId, { id: item.playerId, name: item.playerName }])).values()];
  const ratingDisabled = authLoading || !session || !panel.ratingOpen || pending;

  function openComposer(player: MobileFanRatingPlayer) {
    if (ratingDisabled) return;
    setSelectedPlayer(player);
    setSelectedRating(localRatings[player.id] ?? player.myRating);
    setReview('');
    setMutationError(null);
    setComposerOpen(true);
  }

  function closeComposer() {
    if (pending) return;
    setComposerOpen(false);
    setMutationError(null);
  }

  async function submitRating() {
    if (!selectedPlayer || selectedRating == null || pending) return;
    setPending(true);
    setMutationError(null);
    try {
      const saved = await mutateMobileApi<MobileFanRatingMutationDto>(`/api/mobile/v1/matches/${encodeURIComponent(matchId)}/ratings`, 'POST', { playerId: selectedPlayer.id, rating: selectedRating, review, setId });
      setLocalRatings((current) => ({ ...current, [saved.playerId]: saved.rating }));
      setComposerOpen(false);
      setSelectedPlayer(null);
      setReview('');
      showToast('평점이 제출되었습니다!', 'success');
      await invalidateApiCache(`/api/mobile/v1/matches/${matchId}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '평점 제출에 실패했습니다.';
      setMutationError(message);
      showToast(message, 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.root}>
      {!session ? <View style={[styles.loginBanner, { backgroundColor: theme.card }]}><Text style={{ color: theme.muted, flex: 1, ...fonts.regular, fontSize: 14, lineHeight: 22 }}>평점을 남기려면 로그인이 필요합니다.</Text><Pressable disabled={authLoading} onPress={() => router.push(`/login?next=${encodeURIComponent(`/matches/${matchId}?tab=rating&set=${setId}`)}` as never)} style={({ pressed }) => [styles.loginButton, { backgroundColor: theme.ink, opacity: authLoading ? 0.45 : pressed ? 0.78 : 1 }]}><Text style={{ color: theme.surface, ...fonts.medium, fontSize: 15 }}>로그인</Text></Pressable></View> : null}
      {teams.map((teamId) => <TeamRatingGroup disabled={ratingDisabled} key={teamId} localRatings={localRatings} onSelect={openComposer} players={panel.players.filter((player) => player.team?.id === teamId)} selectedPlayerId={selectedPlayer?.id ?? null} />)}
      <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22 }}>{panel.statusNote}</Text>
      <View style={styles.commentsSection}>
        <View style={styles.commentsHead}><Text style={{ color: theme.ink, ...fonts.black, fontSize: 18 }}>평가 코멘트</Text>{panel.comments.length > 0 ? <Pressable onPress={() => setFilterOpen(true)} style={[styles.filter, { backgroundColor: theme.card }]}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{playerId ? `${filterPlayers.find((item) => item.id === playerId)?.name} (${comments.length})` : `전체 선수 (${panel.comments.length})`}</Text><ChevronDown color={theme.muted} size={16} /></Pressable> : null}</View>
        {comments.length === 0 ? <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 14, lineHeight: 22, marginTop: 8 }}>아직 작성된 평가 코멘트가 없습니다.</Text> : <View style={styles.commentList}>{comments.map((item) => <RatingComment item={item} key={item.id} />)}</View>}
      </View>
      <BottomSheet onClose={() => setFilterOpen(false)} open={filterOpen} title="선수별 코멘트 필터" titleStyle={styles.sheetTitle}><View style={styles.filterList}><Pressable onPress={() => { setPlayerId(null); setFilterOpen(false); }} style={styles.filterItem}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>전체 선수 ({panel.comments.length})</Text></Pressable>{filterPlayers.map((player) => <Pressable key={player.id} onPress={() => { setPlayerId(player.id); setFilterOpen(false); }} style={styles.filterItem}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{player.name} ({panel.comments.filter((item) => item.playerId === player.id).length})</Text></Pressable>)}</View></BottomSheet>
      <BottomSheet contentStyle={styles.composerBody} onClose={closeComposer} open={composerOpen && Boolean(selectedPlayer)} scrollable title={selectedPlayer ? `${selectedPlayer.name} 평가` : '선수 평가'} titleStyle={styles.sheetTitle}>
        {selectedPlayer ? <>
          <View style={styles.composerPlayer}>
            <View style={[styles.composerAvatar, { backgroundColor: theme.surfaceMuted }]}>{selectedPlayer.profileImage?.url ? <Image accessibilityLabel="" contentFit="cover" contentPosition="top" source={{ uri: resolveApiAssetUrl(selectedPlayer.profileImage.url) ?? undefined }} style={styles.fill} /> : null}</View>
            <View style={styles.composerIdentity}><Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 15 }}>{selectedPlayer.name}</Text><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{selectedPlayer.team?.name} · {selectedPlayer.position}</Text></View>
          </View>
          <StarRatingPicker disabled={pending} onChange={setSelectedRating} value={selectedRating} />
          <TextInput maxLength={MAX_REVIEW_LENGTH} multiline onChangeText={setReview} placeholder="평가 코멘트 (선택)" placeholderTextColor={theme.muted} style={[styles.reviewInput, { backgroundColor: theme.surfaceMuted, color: theme.text, ...fonts.regular }]} textAlignVertical="top" value={review} />
          {mutationError ? <Text style={{ color: '#ef4444', ...fonts.regular, fontSize: 13, lineHeight: 19 }}>{mutationError}</Text> : null}
          <View style={styles.composerActions}><Text style={{ color: theme.muted, ...fonts.regular, fontSize: 13 }}>{review.length}/{MAX_REVIEW_LENGTH}자</Text><Pressable disabled={selectedRating == null || pending} onPress={() => void submitRating()} style={({ pressed }) => [styles.submitButton, { backgroundColor: theme.surface, borderColor: theme.border, opacity: selectedRating == null || pending ? 0.45 : pressed ? 0.78 : 1 }]}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>{pending ? '등록 중' : '등록'}</Text></Pressable></View>
        </> : null}
      </BottomSheet>
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
  composerActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  composerAvatar: { borderRadius: 24, height: 48, overflow: 'hidden', width: 48 },
  composerBody: { gap: 16, paddingTop: 4 },
  composerIdentity: { flex: 1, gap: 5 },
  composerPlayer: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  empty: { borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, padding: 16 },
  fill: { height: '100%', width: '100%' },
  filter: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, height: 36, maxWidth: '55%', paddingHorizontal: 12 },
  filterItem: { justifyContent: 'center', minHeight: 48 },
  filterList: { paddingBottom: 8 },
  leftHalf: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 10 },
  loginBanner: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  loginButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  playerBadge: { alignItems: 'center', borderRadius: 4, flexDirection: 'row', gap: 6, paddingRight: 6 },
  playerIdentity: { flex: 1, gap: 4, minWidth: 0 },
  playerList: { gap: 8 },
  playerNameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  playerPortrait: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', overflow: 'hidden', width: 64 },
  playerRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 12, height: 76, overflow: 'hidden', paddingRight: 12 },
  pog: { backgroundColor: '#fbbf24', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  ratingSummary: { alignItems: 'flex-end' },
  ratingValue: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  reviewInput: { borderRadius: 12, fontSize: 14, lineHeight: 22, minHeight: 80, padding: 12 },
  rightHalf: { bottom: 0, position: 'absolute', right: 0, top: 0, width: 10 },
  root: { gap: 16 },
  selectedValue: { alignItems: 'baseline', flexDirection: 'row', gap: 4 },
  sheetTitle: { fontSize: 14 },
  starFillClip: { height: 20, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  starList: { alignItems: 'center', flexDirection: 'row' },
  starPicker: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 32 },
  starSlot: { height: 20, position: 'relative', width: 20 },
  submitButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 40, justifyContent: 'center', paddingHorizontal: 16 },
  teamGroup: { gap: 8 },
  teamHeading: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
});
