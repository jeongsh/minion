import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Star from 'lucide-react-native/icons/star';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RankAvatar } from '@/components/rank-avatar';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { fetchMobileQuery, type MobilePlayerReview, type MobilePlayerReviewPage } from '@/lib/api-client';
import { formatStoredFanRating as formatFanRating } from '@/lib/fan-rating-display';

export type PlayerFanReviewsHandle = {
  checkViewport: () => void;
};

export const PlayerFanReviews = forwardRef<PlayerFanReviewsHandle, {
  averageRating: number | null;
  pogCount: number;
  reviews: MobilePlayerReview[];
  playerSlug: string;
  segment: string;
  initialCursor: string | null;
}>(function PlayerFanReviews({ averageRating, pogCount, reviews, playerSlug, segment, initialCursor }, ref) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [items, setItems] = useState(reviews);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<View>(null);
  const requestRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const hasMore = Boolean(nextCursor);

  const loadNext = useCallback(async () => {
    if (!nextCursor || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(false);
    try {
      const query = new URLSearchParams({ segment, cursor: nextCursor });
      const path = `/api/mobile/v1/players/${encodeURIComponent(playerSlug)}/reviews?${query}`;
      const page = await fetchMobileQuery<MobilePlayerReviewPage>(path, path, false, false, {
        signal: controller.signal, cancelOnUnused: true,
      });
      if (controller.signal.aborted) return;
      setItems((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !ids.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [nextCursor, playerSlug, segment]);

  const checkViewport = useCallback(() => {
    if (!hasMore || error || requestRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      sentinelRef.current?.measureInWindow((_x, y, _width, height) => {
        if (y <= windowHeight + 120 && y + height >= -120) void loadNext();
      });
    });
  }, [hasMore, error, loadNext, windowHeight]);

  useImperativeHandle(ref, () => ({ checkViewport }), [checkViewport]);

  useEffect(() => {
    const frame = requestAnimationFrame(checkViewport);
    return () => cancelAnimationFrame(frame);
  }, [checkViewport, items.length]);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <View onLayout={checkViewport} testID="player-fan-reviews">
      <View style={styles.headingRow}>
        <Text style={{ color: theme.ink, ...fonts.display, fontSize: 20, lineHeight: 28 }}>팬 평가</Text>
        <Text style={[styles.headingMeta, { color: theme.muted, ...fonts.medium }]}>
          팬 평점 <Text style={{ color: theme.ink, ...fonts.medium }}>{formatFanRating(averageRating)}</Text>
        </Text>
        <Text style={[styles.headingMeta, { color: theme.muted, ...fonts.medium }]}>
          팬 POG <Text style={{ color: theme.ink, ...fonts.medium }}>{pogCount}</Text>
        </Text>
      </View>
      {items.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.muted, ...fonts.regular, fontSize: 16, lineHeight: 28 }}>작성된 선수 리뷰가 아직 없습니다.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((review) => (
            <View key={review.id} testID={`player-fan-review-${review.id}`} style={[styles.review, { backgroundColor: theme.card }]}>
              <View style={styles.reviewHeader}>
                <View style={styles.author}>
                  <RankAvatar fallback={review.authorName} profileImageUrl={review.authorImage?.url} size="comment" tier={review.authorTier as never} />
                  <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{review.authorName}</Text>
                </View>
                <View style={styles.rating}>
                  <Star color="#fbbf24" fill="#fbbf24" size={16} />
                  <Text style={{ color: theme.ink, ...fonts.medium, fontSize: 16, lineHeight: 24 }}>{formatFanRating(review.rating)}</Text>
                </View>
              </View>
              <Text style={{ color: theme.text, ...fonts.regular, fontSize: 16, lineHeight: 28, marginTop: 8 }}>{review.review}</Text>
              <Pressable disabled={!review.href} accessibilityRole="link" accessibilityLabel={review.meta} style={styles.reviewMeta} onPress={() => review.href ? router.push(review.href as never) : undefined}>
                {(review.metaParts ?? [review.meta]).map((part, index) => <Text key={index} style={{ color: theme.muted, ...fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{part}</Text>)}
              </Pressable>
            </View>
          ))}
          {hasMore ? (
            <View accessibilityLiveRegion="polite" collapsable={false} ref={sentinelRef} style={styles.more}>
              {error ? <>
                <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>리뷰를 불러오지 못했습니다.</Text>
                <Pressable accessibilityRole="button" style={styles.moreAction} onPress={() => void loadNext()}><Text style={{ color: theme.ink, ...fonts.medium, fontSize: 14 }}>다시 시도</Text></Pressable>
              </> : loading ? <>
                <ActivityIndicator color={theme.muted} size="small" />
                <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>불러오는 중</Text>
              </> : <Pressable accessibilityRole="button" style={styles.moreAction} onPress={() => void loadNext()}>
                <ChevronDown color={theme.muted} size={16} />
                <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 14 }}>아래로 스크롤해 더 보기</Text>
              </Pressable>}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  author: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  empty: { borderRadius: 12, padding: 16 },
  headingMeta: { fontSize: 14, lineHeight: 20 },
  headingRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginBottom: 12 },
  list: { gap: 12 },
  more: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', minHeight: 44 },
  moreAction: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  rating: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  review: { borderRadius: 12, padding: 14 },
  reviewHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  reviewMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, marginTop: 8 },
});
