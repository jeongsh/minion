import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Heart from 'lucide-react-native/icons/heart';
import Home from 'lucide-react-native/icons/house';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import Shield from 'lucide-react-native/icons/shield';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinionTheme } from '@/hooks/use-minion-theme';

type DockItem = { href: '/' | '/schedule' | '/fan' | '/teams' | '/community'; label: string; icon: LucideIcon };

const items: DockItem[] = [
  { href: '/', label: '홈', icon: Home },
  { href: '/schedule', label: '매치', icon: CalendarDays },
  { href: '/fan', label: '팬', icon: Heart },
  { href: '/teams', label: '팀', icon: Shield },
  { href: '/community', label: '팬톡', icon: MessagesSquare },
];

function isActive(pathname: string, href: DockItem['href']) {
  if (href === '/') return pathname === '/' || pathname === '/index';
  const fanTalkRoute = pathname === '/community' || pathname.startsWith('/community/') || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
  if (href === '/fan') return !fanTalkRoute && (pathname === '/fan' || pathname.startsWith('/fan/'));
  if (href === '/community') return fanTalkRoute;
  if (href === '/schedule') return ['/schedule', '/matches', '/tournaments', '/predictions'].some((path) => pathname.startsWith(path));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MinionDock() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, favoriteTeam, fonts, openTeamPicker, theme } = useMinionTheme();

  const dockBorder = colorScheme === 'dark' ? '#343840' : '#e8e8eb';
  const inactiveColor = colorScheme === 'dark' ? '#a7acb5' : '#777b82';

  return (
    <View accessibilityRole="tablist" style={[styles.dock, { backgroundColor: theme.pageBackground, borderTopColor: dockBorder, height: theme.size.dock + insets.bottom, paddingBottom: insets.bottom }]}>
      {items.map(({ href, icon: Icon, label }) => {
        const active = isActive(pathname, href);
        const fanLogo = href === '/fan' && favoriteTeam;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={href}
            onPress={() => {
              if (href === '/fan') {
                if (!favoriteTeam) openTeamPicker();
                else router.navigate(`/fan/${favoriteTeam.slug}`);
                return;
              }
              if (href === '/community') {
                router.navigate(favoriteTeam ? `/fan/${favoriteTeam.slug}/community` : '/community');
                return;
              }
              router.navigate(href);
            }}
            style={styles.item}>
            {fanLogo ? (
              <View style={[styles.favoriteLogo, { backgroundColor: theme.surfaceMuted, borderColor: theme.pageBackground }]}>
                <Image contentFit="contain" source={favoriteTeam.logo} style={styles.logoImage} />
              </View>
            ) : (
              <View style={styles.iconBox}>
                <Icon color={active ? theme.ink : inactiveColor} size={20} strokeWidth={active ? 2.5 : 2} />
              </View>
            )}
            <Text numberOfLines={1} style={[styles.label, { color: active ? theme.ink : inactiveColor, ...fonts.display }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { alignItems: 'flex-start', borderTopWidth: 1, bottom: 0, flexDirection: 'row', left: 0, paddingTop: 4, position: 'absolute', right: 0, zIndex: 50 },
  item: { alignItems: 'center', flex: 1, gap: 2, minWidth: 0, paddingHorizontal: 4, paddingVertical: 4 },
  iconBox: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
  label: { fontSize: 11, lineHeight: 16.5 },
  favoriteLogo: { alignItems: 'center', borderRadius: 20, borderWidth: 3, height: 40, justifyContent: 'center', marginTop: -20, width: 40 },
  logoImage: { height: 28, width: 28 },
});
