import { Image } from 'expo-image';
import { usePathname, useRouter, type Href } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import { type PropsWithChildren, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/feedback-states';
import { MinionFooter } from '@/components/minion-footer';
import { getMinionTeam } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';

const HEADER_HEIGHT = 56;
const LOCAL_NAV_HEIGHT = 49;
const logo = require('@/assets/images/logo.svg');

type LocalItem = { label: string; href: Href };

const hubItems: LocalItem[] = [
  { label: '메인', href: '/' },
  { label: '대회', href: '/tournaments' },
  { label: '승부예측', href: '/predictions' },
  { label: '선수', href: '/players' },
  { label: '커뮤니티', href: '/community' },
];

function getFanItems(team: string): LocalItem[] {
  return [
    { label: '홈', href: `/fan/${team}` },
    { label: '일정', href: `/fan/${team}/schedule` },
    { label: '선수', href: `/fan/${team}/players` },
    { label: '커뮤니티', href: `/fan/${team}/community` },
    { label: '소셜', href: `/fan/${team}/social` },
    { label: '영상', href: `/fan/${team}/videos` },
  ];
}

type MinionScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  scrollRequest?: { animated: boolean; y: number } | null;
  stickyHeader?: ReactNode;
  stickyHeaderHeight?: number;
}>;

export function MinionScreen({ children, contentStyle, scrollRequest, stickyHeader, stickyHeaderHeight = 0 }: MinionScreenProps) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, fonts, openTeamPicker, showToast, theme, toggleTheme } = useMinionTheme();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const headerOffset = useRef(new Animated.Value(0)).current;
  const headerVisible = useRef(true);
  const lastScrollY = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fanMatch = pathname.match(/^\/fan\/([^/]+)/);
  const fanTeam = getMinionTeam(fanMatch?.[1]);
  const accent = fanTeam?.primaryColor ?? theme.accent;
  const localItems = fanTeam ? getFanItems(fanTeam.slug) : pathname === '/fan' ? [] : hubItems;
  const localNavHeight = localItems.length > 0 ? LOCAL_NAV_HEIGHT : 0;
  const headerIconColor = colorScheme === 'dark' ? '#a7acb5' : '#62666d';
  const headerBorder = colorScheme === 'dark' ? '#343840' : '#e8e8eb';

  const setHeaderVisible = (visible: boolean, animated = true) => {
    if (headerVisible.current === visible && animated) return;
    headerVisible.current = visible;
    const toValue = visible ? 0 : -HEADER_HEIGHT;
    if (!animated) {
      headerOffset.setValue(toValue);
      return;
    }
    Animated.timing(headerOffset, {
      duration: 200,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      toValue,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    lastScrollY.current = 0;
    headerVisible.current = true;
    headerOffset.setValue(0);
  }, [headerOffset, pathname]);

  useEffect(() => {
    if (!scrollRequest) return;
    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ animated: scrollRequest.animated, x: 0, y: scrollRequest.y });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest]);
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = currentY - lastScrollY.current;
    if (currentY < 16) setHeaderVisible(true);
    else if (delta > 4) setHeaderVisible(false);
    else if (delta < -4) setHeaderVisible(true);
    lastScrollY.current = currentY;
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />

      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: theme.pageBackground,
            borderBottomColor: headerBorder,
            top: insets.top,
            transform: [{ translateY: headerOffset }],
          },
        ]}>
        <View style={[styles.brandArea, fanTeam ? styles.fanBrandArea : null]}>
          <Pressable accessibilityLabel="MINION 메인으로 이동" onPress={() => router.navigate('/')} style={[styles.brandButton, fanTeam ? null : styles.brandButtonDefault]}>
            <Image accessibilityLabel="MINION" alt="MINION" contentFit="contain" source={logo} style={[styles.logo, fanTeam ? { tintColor: accent } : null]} />
          </Pressable>
          {fanTeam ? (
            <Pressable accessibilityLabel="팬페이지 팀 변경" onPress={openTeamPicker} style={styles.teamSwitch}>
              <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: fonts.bold, fontSize: 14 }}>{fanTeam.shortName}</Text>
              <ChevronDown color={theme.ink} size={16} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="알림 열기" onPress={() => setNotificationOpen(true)} style={styles.iconButton}>
            <Bell color={headerIconColor} size={20} />
          </Pressable>
          <Pressable accessibilityLabel={colorScheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} onPress={toggleTheme} style={[styles.iconButton, styles.themeButton]}>
            {colorScheme === 'dark' ? <Sun color={headerIconColor} size={20} /> : <Moon color={headerIconColor} size={20} />}
          </Pressable>
          <Pressable onPress={() => showToast('로그인은 인증 화면 구현 단계에서 연결합니다.')} style={styles.loginButton}>
            <Text style={[styles.loginText, { fontFamily: fonts.bold }]}>로그인</Text>
          </Pressable>
        </View>
      </Animated.View>

      {localItems.length > 0 ? (
        <Animated.View
          style={[
            styles.localBar,
            {
              backgroundColor: theme.pageBackground,
              borderBottomColor: theme.border,
              borderBottomWidth: pathname === '/schedule' ? 0 : 1,
              top: Animated.add(headerOffset, insets.top + HEADER_HEIGHT),
            },
          ]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.localContent}>
            {localItems.map((item) => {
              const href = String(item.href);
              const active = pathname === href || (href === '/' && pathname === '/index');
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={href}
                  onPress={() => router.navigate(item.href)}
                  style={[styles.localItem, { minWidth: fanTeam ? 56 : 64 }]}>
                  <Text style={{ color: active ? accent : theme.muted, fontFamily: fonts.display, fontSize: 14, lineHeight: 21 }}>{item.label}</Text>
                  {active ? <View style={[styles.activeLine, { backgroundColor: accent }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}

      {stickyHeader ? (
        <Animated.View
          style={[
            styles.stickyHeader,
            {
              top: Animated.add(headerOffset, insets.top + HEADER_HEIGHT + localNavHeight),
            },
          ]}>
          {stickyHeader}
        </Animated.View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + HEADER_HEIGHT + localNavHeight + (stickyHeader ? stickyHeaderHeight : 16) }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, contentStyle]}>{children}</View>
        <View style={styles.footer}><MinionFooter /></View>
      </ScrollView>

      <BottomSheet onClose={() => setNotificationOpen(false)} open={notificationOpen} title="알림">
        <EmptyState description="새로운 경기와 팬 활동 알림이 여기에 표시됩니다." title="새 알림이 없습니다" />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 60 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 56, left: 0, paddingHorizontal: 12, position: 'absolute', right: 0, zIndex: 50 },
  brandArea: { alignItems: 'center', flexDirection: 'row' },
  fanBrandArea: { flex: 1, minWidth: 0 },
  brandButton: { alignItems: 'center', height: 44, justifyContent: 'center' },
  brandButtonDefault: { marginLeft: 6 },
  logo: { aspectRatio: 171 / 39, width: 64 },
  teamSwitch: { alignItems: 'center', flexDirection: 'row', gap: 4, marginLeft: 0, maxWidth: 76, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8 },
  headerActions: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto' },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  themeButton: { marginRight: 8 },
  loginButton: { alignItems: 'center', backgroundColor: '#141517', borderRadius: 12, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  loginText: { color: '#ffffff', fontSize: 13, lineHeight: 19.5 },
  localBar: { height: 49, left: 0, position: 'absolute', right: 0, zIndex: 40 },
  localContent: { minWidth: '100%' },
  localItem: { alignItems: 'center', flexBasis: 0, flexGrow: 1, height: 48, justifyContent: 'center', paddingBottom: 3, paddingTop: 2, position: 'relative' },
  activeLine: { bottom: 0, height: 3, left: 0, position: 'absolute', right: 0 },
  footer: { paddingHorizontal: 16 },
  stickyHeader: { left: 0, paddingHorizontal: 16, position: 'absolute', right: 0, zIndex: 30 },
  content: { gap: 16, paddingBottom: 0, paddingHorizontal: 16 },
});
