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

import { MinionFooter } from '@/components/minion-footer';
import { MinionBrandLogo } from '@/components/minion-brand-logo';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import { RankAvatar } from '@/components/rank-avatar';
import { getMinionTeam, type MinionTeam } from '@/constants/teams';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';
import { fanAccentText } from '@/lib/fan-colors';
import { useAuth } from '@/providers/auth-provider';
import { useInAppNotifications } from '@/providers/in-app-notifications-provider';

const HEADER_HEIGHT = 56;
const LOCAL_NAV_HEIGHT = 49;
const FAN_HEADER_TEAM_ORDER = ['fox', 'soop', 'dk', 'geng', 'drx', 'kt', 't1', 'ns', 'bro', 'hle'];
const FAN_DARK_LOGO_TEAMS = new Set(['dk', 'kt', 'drx', 'bro', 'fox']);
const fanHeaderTeams = FAN_HEADER_TEAM_ORDER.map((slug) => getMinionTeam(slug)).filter((team): team is MinionTeam => Boolean(team));

type LocalItem = { label: string; href: Href };

const hubItems: LocalItem[] = [
  { label: '메인', href: '/' },
  { label: '대회', href: '/tournaments' },
  { label: '승부예측', href: '/predictions' },
  { label: '선수', href: '/players' },
  { label: '챔피언', href: '/champions' },
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
  onScrollYChange?: (y: number, headerVisible: boolean) => void;
  scrollRequest?: { animated: boolean; y: number } | null;
  stickyHeader?: ReactNode;
  stickyHeaderHeight?: number;
  stickyHeaderReserveSpace?: boolean;
  stickyHeaderVisible?: boolean;
}>;

export function MinionScreen({
  children,
  contentStyle,
  onScrollYChange,
  scrollRequest,
  stickyHeader,
  stickyHeaderHeight = 0,
  stickyHeaderReserveSpace = true,
  stickyHeaderVisible = true,
}: MinionScreenProps) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, fonts, theme, toggleTheme } = useMinionTheme();
  const { loading: authLoading, session, viewer } = useAuth();
  const { unreadCount } = useInAppNotifications();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [teamSwitcherOpen, setTeamSwitcherOpen] = useState(false);
  const headerOffset = useRef(new Animated.Value(0)).current;
  const headerVisible = useRef(true);
  const lastScrollY = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fanMatch = pathname.match(/^\/fan\/([^/]+)/);
  const fanTeam = getMinionTeam(fanMatch?.[1]);
  const accent = fanTeam ? fanAccentText(fanTeam.primaryColor) : theme.accent;
  const localItems = fanTeam ? getFanItems(fanTeam.slug) : pathname === '/fan' ? [] : hubItems;
  const localNavHeight = localItems.length > 0 ? LOCAL_NAV_HEIGHT : 0;
  const contentChromeOffset = insets.top + HEADER_HEIGHT + localNavHeight;
  const contentFlowOffset = stickyHeader && stickyHeaderReserveSpace ? stickyHeaderHeight : 16;
  const headerIconColor = colorScheme === 'dark' ? '#a7acb5' : '#62666d';
  const headerBorder = colorScheme === 'dark' ? '#212224' : '#e8e8eb';

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
    scrollViewRef.current?.scrollTo({ animated: false, x: 0, y: 0 });
    setTeamSwitcherOpen(false);
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
    onScrollYChange?.(currentY, headerVisible.current);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <View style={[styles.safeTop, { backgroundColor: theme.pageBackground, height: insets.top }]} />
      {teamSwitcherOpen ? <Pressable accessibilityLabel="팀 전환 메뉴 닫기" onPress={() => setTeamSwitcherOpen(false)} style={styles.teamMenuBackdrop} /> : null}

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
            <MinionBrandLogo color={fanTeam?.primaryColor} />
          </Pressable>
          {fanTeam ? (
            <>
              <Pressable accessibilityLabel={`현재 ${fanTeam.name} 팬페이지, 팀 전환`} accessibilityRole="button" accessibilityState={{ expanded: teamSwitcherOpen }} onPress={() => setTeamSwitcherOpen((open) => !open)} style={styles.teamSwitch}>
                <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.black, fontSize: 14, lineHeight: 21 }}>{fanTeam.shortName}</Text>
                <ChevronDown color={theme.ink} size={16} style={teamSwitcherOpen ? styles.teamSwitchChevronOpen : null} />
              </Pressable>
              {teamSwitcherOpen ? (
                <View accessibilityLabel="팀 팬페이지 이동" accessibilityRole="menu" style={[styles.teamMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {fanHeaderTeams.map((team) => {
                    const whiteLogo = colorScheme === 'dark' && FAN_DARK_LOGO_TEAMS.has(team.slug);
                    const logoUri = resolveApiAssetUrl(`/logos/${team.slug}${whiteLogo ? '-white' : ''}.svg`);
                    return (
                      <Pressable accessibilityLabel={`${team.name} 팬페이지로 이동`} accessibilityRole="menuitem" key={team.id} onPress={() => { setTeamSwitcherOpen(false); router.navigate(`/fan/${team.slug}` as never); }} style={({ pressed }) => [styles.teamMenuItem, pressed && { backgroundColor: theme.cardHover }]}>
                        <View style={[styles.teamMenuLogo, { backgroundColor: theme.surfaceMuted }]}><Image contentFit="contain" source={logoUri ? { uri: logoUri } : team.logo} style={styles.teamMenuLogoImage} /></View>
                        <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 14, lineHeight: 21 }}>{team.shortName}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel={`알림 열기${unreadCount > 0 ? `, 읽지 않은 알림 ${unreadCount}개` : ''}`} onPress={() => setNotificationOpen(true)} style={styles.iconButton}>
            <Bell color={headerIconColor} size={20} />
            {unreadCount > 0 ? (
              <View accessibilityElementsHidden pointerEvents="none" style={[styles.notificationBadge, { backgroundColor: theme.accent }]}>
                <Text style={{ color: '#ffffff', ...fonts.medium, fontSize: 12, lineHeight: 16 }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityLabel={colorScheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} onPress={toggleTheme} style={[styles.iconButton, styles.themeButton]}>
            {colorScheme === 'dark' ? <Sun color={headerIconColor} size={20} /> : <Moon color={headerIconColor} size={20} />}
          </Pressable>
          <Pressable disabled={authLoading} onPress={() => session ? router.navigate('/me') : router.navigate(`/login?next=${encodeURIComponent(pathname)}` as never)} style={session ? styles.profileButton : styles.loginButton}>
            {session ? <RankAvatar fallback={viewer?.nickname ?? 'MY'} profileImageUrl={viewer?.profileImage?.url} tier={viewer?.tier} /> : <Text style={[styles.loginText, { ...fonts.bold }]}>로그인</Text>}
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
              const fanHomeHref = fanTeam ? `/fan/${fanTeam.slug}` : null;
              const active = href === '/'
                ? pathname === '/' || pathname === '/index'
                : href === fanHomeHref
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={href}
                  onPress={() => router.navigate(item.href)}
                  style={[styles.localItem, { minWidth: fanTeam ? 56 : 64 }]}>
                  <Text style={{ color: active ? accent : theme.muted, ...fonts.display, fontSize: 14, lineHeight: 21 }}>{item.label}</Text>
                  {active ? <View style={[styles.activeLine, { backgroundColor: accent }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}

      {stickyHeader ? (
        <Animated.View
          accessibilityElementsHidden={!stickyHeaderVisible}
          importantForAccessibility={stickyHeaderVisible ? 'auto' : 'no-hide-descendants'}
          pointerEvents={stickyHeaderVisible ? 'auto' : 'none'}
          style={[
            styles.stickyHeader,
            {
              opacity: stickyHeaderVisible ? 1 : 0,
              top: Animated.add(headerOffset, insets.top + HEADER_HEIGHT + localNavHeight),
            },
          ]}>
          {stickyHeader}
        </Animated.View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View aria-hidden style={{ height: contentChromeOffset }} />
        <View style={[styles.content, { marginTop: contentFlowOffset }, contentStyle]}>{children}</View>
        <View style={styles.footer}><MinionFooter accentColor={fanTeam?.primaryColor} /></View>
      </ScrollView>

      <NotificationPanel onClose={() => setNotificationOpen(false)} open={notificationOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 60 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', height: 56, left: 0, paddingHorizontal: 12, position: 'absolute', right: 0, zIndex: 50 },
  brandArea: { alignItems: 'center', flexDirection: 'row', position: 'relative' },
  fanBrandArea: { flex: 1, minWidth: 0 },
  brandButton: { alignItems: 'center', height: 44, justifyContent: 'center' },
  brandButtonDefault: { marginLeft: 6 },
  teamMenu: { borderRadius: 16, borderWidth: 1, left: 0, overflow: 'hidden', padding: 8, position: 'absolute', top: 48, width: 216, zIndex: 52 },
  teamMenuBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 45 },
  teamMenuItem: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 12, minHeight: 44, paddingHorizontal: 12 },
  teamMenuLogo: { alignItems: 'center', borderRadius: 14, height: 28, justifyContent: 'center', overflow: 'hidden', width: 28 },
  teamMenuLogoImage: { height: 20, width: 20 },
  teamSwitch: { alignItems: 'center', flexDirection: 'row', gap: 4, height: 37, marginLeft: 0, maxWidth: 76, paddingHorizontal: 8 },
  teamSwitchChevronOpen: { transform: [{ rotate: '180deg' }] },
  headerActions: { alignItems: 'center', flexDirection: 'row', marginLeft: 'auto' },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  notificationBadge: { alignItems: 'center', borderRadius: 8, height: 16, justifyContent: 'center', minWidth: 16, paddingHorizontal: 2, position: 'absolute', right: 1, top: 1 },
  themeButton: { marginRight: 8 },
  profileButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 32 },
  loginButton: { alignItems: 'center', backgroundColor: '#141517', borderRadius: 12, justifyContent: 'center', maxWidth: 76, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  loginText: { color: '#ffffff', fontSize: 13, lineHeight: 19.5, maxWidth: 52 },
  localBar: { height: 49, left: 0, position: 'absolute', right: 0, zIndex: 40 },
  localContent: { minWidth: '100%' },
  localItem: { alignItems: 'center', flexBasis: 0, flexGrow: 1, height: 48, justifyContent: 'center', paddingBottom: 3, paddingTop: 2, position: 'relative' },
  activeLine: { bottom: 0, height: 3, left: 0, position: 'absolute', right: 0 },
  footer: { paddingHorizontal: 16 },
  stickyHeader: { left: 0, paddingHorizontal: 16, position: 'absolute', right: 0, zIndex: 30 },
  content: { gap: 16, paddingBottom: 0, paddingHorizontal: 16 },
});
