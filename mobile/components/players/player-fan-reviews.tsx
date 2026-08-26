import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Star from 'lucide-react-native/icons/star';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RankAvatar } from '@/components/rank-avatar';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobilePlayerReview } from '@/lib/api-client';

const PAGE_SIZE = 5;

export type PlayerFanReviewsHandle = {
  checkViewport: () => void;
};

export const PlayerFanReviews = forwardRef<PlayerFanReviewsHandle, {
  averageRating: number | null;
  pogCount: number;
  reviews: MobilePlayerReview[];
}>(function PlayerFanReviews({ averageRating, pogCount, reviews }, ref) {
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<View>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const visible = reviews.slice(0, visibleCount);
  const hasMore = visibleCount < reviews.length;

  const loadNext = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    timerRef.current = setTimeout(() => {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, reviews.length));
      loadingRef.current = false;
      setLoading(false);
    }, 450);
  }, [hasMore, reviews.length]);

  const checkViewport = useCallback(() => {
    if (!hasMore || loadingRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      sentinelRef.current?.measureInWindow((_x, y, _width, height) => {
        if (y <= windowHeight + 120 && y + height >= -120) loadNext();
      });
    });
  }, [hasMore, loadNext, windowHeight]);

  useImperativeHandle(ref, () => ({ checkViewport }), [checkViewport]);

  useEffect(() => {
    const frame = requestAnimationFrame(checkViewport);
    return () => cancelAnimationFrame(frame);
  }, [checkViewport, visibleCount]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <View onLayout={checkViewport}>
      <View style={styles.headingRow}>
        <Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 16, lineHeight: 22 }}>팬 평가</Text>
        <Text style={[styles.headingMeta, { color: theme.muted, fontFamily: fonts.medium }]}>
          팬 평점 <Text style={{ color: theme.ink, fontFamily: fonts.medium }}>{averageRating == null ? '-' : averageRating.toFixed(1)}</Text>
        </Text>
        <Text style={[styles.headingMeta, { color: theme.muted, fontFamily: fonts.medium }]}>
          팬 POG <Text style={{ color: theme.ink, fontFamily: fonts.medium }}>{pogCount}</Text>
        </Text>
      </View>
      {reviews.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 28 }}>작성된 선수 리뷰가 아직 없습니다.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((review) => (
            <View key={review.id} style={[styles.review, { backgroundColor: theme.card }]}>
              <View style={styles.reviewHeader}>
                <View style={styles.author}>
                  <RankAvatar fallback={review.authorName} profileImageUrl={review.authorImage?.url} size="comment" tier={review.authorTier as never} />
                  <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5 }}>{review.authorName}</Text>
                </View>
                <View style={styles.rating}>
                  <Star color="#fbbf24" fill="#fbbf24" size={16} />
                  <Text style={{ color: theme.ink, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 }}>{review.rating.toFixed(1)}</Text>
                </View>
              </View>
              <Text style={{ color: theme.text, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 8 }}>{review.review}</Text>
              <Pressable disabled={!review.href} onPress={() => review.href ? router.push(review.href as never) : undefined}>
                <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19.5, marginTop: 8 }}>{review.meta}</Text>
              </Pressable>
            </View>
          ))}
          {hasMore ? (
            <View accessibilityLiveRegion="polite" collapsable={false} ref={sentinelRef} style={styles.more}>
              {loading ? <ActivityIndicator color={theme.muted} size="small" /> : <ChevronDown color={theme.muted} size={16} />}
              <Text style={{ color: theme.muted, fontFamily: fonts.medium, fontSize: 13 }}>{loading ? '불러오는 중' : '아래로 스크롤해 더 보기'}</Text>
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
  headingRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  list: { gap: 12 },
  more: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44 },
  rating: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  review: { borderRadius: 12, padding: 14 },
  reviewHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
