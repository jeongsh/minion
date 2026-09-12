import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import CheckCircle2 from 'lucide-react-native/icons/circle-check-big';
import Info from 'lucide-react-native/icons/info';
import Radio from 'lucide-react-native/icons/radio';
import Sword from 'lucide-react-native/icons/sword';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import X from 'lucide-react-native/icons/x';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, Text, type TextStyle, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minionRadius, minionSize, minionThemes, type MinionTheme } from '@/constants/minion-theme';
import { getMinionTeam, type MinionTeam } from '@/constants/teams';
import { resolveApiAssetUrl } from '@/lib/api-client';

const THEME_KEY = 'minion-theme';
const FAVORITE_TEAM_KEY = 'minion-favorite-team';
const PRETENDARD_WEB_STACK = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", sans-serif';
const PAPEROZI_WEB_STACK = 'Paperozi, Pretendard, sans-serif';

type ColorScheme = 'light' | 'dark';
type ToastCharacter = 'attendance' | 'prediction';
type ToastTone = 'success' | 'info' | 'error';
type ToastContent = string | { description?: string; title: string };
export type MatchEventToast = {
  badge: 'LIVE' | '평가';
  kind: 'kill' | 'tower' | 'baron' | 'inhibitor' | 'dragon' | 'end' | 'start' | 'rating';
  leftImageSrc?: string;
  leftLabel?: string;
  matchup: string;
  rightImageSrc?: string;
  rightLabel: string;
};
type ToastItem = {
  character?: ToastCharacter;
  description?: string;
  id: number;
  matchEvent?: MatchEventToast;
  onPress?: () => void;
  title: string;
  tone: ToastTone;
};

type ShellContextValue = {
  colorScheme: ColorScheme;
  favoriteTeam: MinionTeam | null;
  fonts: { regular: TextStyle; medium: TextStyle; bold: TextStyle; black: TextStyle; display: TextStyle };
  openTeamPicker: () => void;
  setFavoriteTeam: (team: MinionTeam | null) => void;
  setTeamPickerOpen: (open: boolean) => void;
  showMatchEventToast: (event: MatchEventToast, onPress?: () => void) => void;
  showToast: (content: ToastContent, tone?: ToastTone, character?: ToastCharacter) => void;
  teamPickerOpen: boolean;
  theme: MinionTheme;
  toggleTheme: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

void SplashScreen.preventAutoHideAsync();

export function MinionShellProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [savedScheme, setSavedScheme] = useState<ColorScheme | null>(null);
  const [favoriteSlug, setFavoriteSlug] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const favoriteTeamOverridden = useRef(false);
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('@/assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('@/assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-Bold': require('@/assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard-Black': require('@/assets/fonts/Pretendard-Black.ttf'),
    'Paperlogy-Bold': require('@/assets/fonts/Paperlogy-7Bold.ttf'),
  });

  const colorScheme: ColorScheme = savedScheme ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo<MinionTheme>(
    () => ({ ...minionThemes[colorScheme], radius: minionRadius, size: minionSize }),
    [colorScheme],
  );
  const favoriteTeam = getMinionTeam(favoriteSlug ?? undefined);

  useEffect(() => {
    void Promise.all([AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(FAVORITE_TEAM_KEY)])
      .then(([storedTheme, storedTeam]) => {
        if (storedTheme === 'light' || storedTheme === 'dark') setSavedScheme(storedTheme);
        if (!favoriteTeamOverridden.current) setFavoriteSlug(storedTeam);
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && hydrated) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded, hydrated]);

  useEffect(() => {
    if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(theme.pageBackground);
  }, [theme.pageBackground]);

  useEffect(() => () => {
    toastTimers.current.forEach((timer) => clearTimeout(timer));
    toastTimers.current.clear();
  }, []);

  const toggleTheme = useCallback(() => {
    setSavedScheme((current) => {
      const effective = current ?? (systemScheme === 'dark' ? 'dark' : 'light');
      const next = effective === 'dark' ? 'light' : 'dark';
      void AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, [systemScheme]);

  const setFavoriteTeam = useCallback((team: MinionTeam | null) => {
    favoriteTeamOverridden.current = true;
    setFavoriteSlug(team?.slug ?? null);
    if (team) void AsyncStorage.setItem(FAVORITE_TEAM_KEY, team.slug);
    else void AsyncStorage.removeItem(FAVORITE_TEAM_KEY);
  }, []);

  const openTeamPicker = useCallback(() => setTeamPickerOpen(true), []);

  const removeToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const enqueueToast = useCallback((toast: Omit<ToastItem, 'id'>, duration: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    toastTimers.current.set(id, setTimeout(() => removeToast(id), duration));
  }, [removeToast]);

  const showToast = useCallback((content: ToastContent, tone: ToastTone = 'info', character?: ToastCharacter) => {
    enqueueToast({ character, ...(typeof content === 'string' ? { title: content } : content), tone }, 2600);
  }, [enqueueToast]);

  const showMatchEventToast = useCallback((matchEvent: MatchEventToast, onPress?: () => void) => {
    enqueueToast({ matchEvent, onPress, title: '', tone: 'info' }, 10_000);
  }, [enqueueToast]);

  const value = useMemo<ShellContextValue>(() => ({
    colorScheme,
    favoriteTeam,
    fonts: {
      regular: fontsLoaded ? Platform.select({ web: { fontFamily: PRETENDARD_WEB_STACK, fontWeight: '400' }, default: { fontFamily: 'Pretendard-Regular', fontWeight: '400' } }) : {},
      medium: fontsLoaded ? Platform.select({ web: { fontFamily: PRETENDARD_WEB_STACK, fontWeight: '500' }, default: { fontFamily: 'Pretendard-Medium', fontWeight: '500' } }) : {},
      bold: fontsLoaded ? Platform.select({ web: { fontFamily: PRETENDARD_WEB_STACK, fontWeight: '700' }, default: { fontFamily: 'Pretendard-Bold', fontWeight: '700' } }) : {},
      black: fontsLoaded ? Platform.select({ web: { fontFamily: PRETENDARD_WEB_STACK, fontWeight: '900' }, default: { fontFamily: 'Pretendard-Black', fontWeight: '900' } }) : {},
      display: fontsLoaded ? Platform.select({ web: { fontFamily: PAPEROZI_WEB_STACK, fontWeight: '400' }, default: { fontFamily: 'Paperlogy-Bold', fontWeight: '400' } }) : {},
    },
    openTeamPicker,
    setFavoriteTeam,
    setTeamPickerOpen,
    showMatchEventToast,
    showToast,
    teamPickerOpen,
    theme,
    toggleTheme,
  }), [colorScheme, favoriteTeam, fontsLoaded, openTeamPicker, setFavoriteTeam, showMatchEventToast, showToast, teamPickerOpen, theme, toggleTheme]);

  return (
    <ShellContext.Provider value={value}>
      {children}
      <ToastViewport onClose={removeToast} toasts={toasts} />
    </ShellContext.Provider>
  );
}

export function useMinionShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useMinionShell must be used inside MinionShellProvider');
  return value;
}

function MatchEventIcon({ kind }: { kind: MatchEventToast['kind'] }) {
  const { theme } = useMinionShell();
  if (kind === 'kill' || kind === 'tower' || kind === 'baron' || kind === 'inhibitor' || kind === 'dragon') return <Sword color={theme.muted} size={16} strokeWidth={2} />;
  if (kind === 'start') return <Radio color={theme.muted} size={15} strokeWidth={2} />;
  return null;
}

function MatchEventImage({ kind, src }: { kind: MatchEventToast['kind']; src: string }) {
  const { theme } = useMinionShell();
  const uri = resolveApiAssetUrl(src);
  if (!uri) return null;
  const mutedStructure = kind === 'tower' || kind === 'inhibitor';
  return <Image contentFit={kind === 'kill' ? 'cover' : 'contain'} source={{ uri }} style={[styles.matchEventImage, kind === 'kill' ? styles.matchEventImageKill : null, mutedStructure ? { tintColor: theme.muted } : null]} />;
}

function MatchEventToastView({ event, maxWidth, onClose, onPress }: { event: MatchEventToast; maxWidth: number; onClose: () => void; onPress?: () => void }) {
  const { colorScheme, fonts, theme } = useMinionShell();
  const open = onPress ? () => { onClose(); onPress(); } : undefined;
  return (
    <Pressable accessibilityLiveRegion="polite" accessibilityRole={onPress ? 'button' : undefined} onPress={open} style={[styles.matchEventToast, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border, maxWidth, minWidth: Math.min(352, maxWidth) }]}>
      <View style={styles.matchEventBadge}>
        {event.badge === 'LIVE' ? <View style={styles.liveDot} /> : null}
        <Text style={{ color: event.badge === 'LIVE' ? '#e51643' : theme.accent, ...fonts.medium, fontSize: event.badge === 'LIVE' ? 12 : 13, lineHeight: 17 }}>{event.badge}</Text>
      </View>
      <View style={styles.matchEventMain}>
        <Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 14, lineHeight: 20, textAlign: 'right' }}>{event.leftLabel ?? ''}</Text>
        {event.leftImageSrc ? <MatchEventImage kind={event.kind} src={event.leftImageSrc} /> : null}
        {event.kind !== 'rating' && event.kind !== 'end' ? <View style={styles.matchEventKind}><MatchEventIcon kind={event.kind} /></View> : null}
        {event.rightImageSrc ? <MatchEventImage kind={event.kind} src={event.rightImageSrc} /> : null}
        <Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 14, lineHeight: 20 }}>{event.rightLabel}</Text>
      </View>
      <Pressable accessibilityLabel="알림 닫기" hitSlop={4} onPress={(pressEvent) => { pressEvent.stopPropagation(); onClose(); }} style={styles.matchEventClose}><X color={theme.muted} size={15} /></Pressable>
    </Pressable>
  );
}

function ToastCopy({ description, title }: { description?: string; title: string }) {
  const { fonts, theme } = useMinionShell();
  return (
    <View style={styles.toastCopy}>
      <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.display, fontSize: 14, lineHeight: 20 }}>{title}</Text>
      {description ? <Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 20 }}>{description}</Text> : null}
    </View>
  );
}

function ToastItemView({ maxWidth, onClose, toast }: { maxWidth: number; onClose: () => void; toast: ToastItem }) {
  const { colorScheme, theme } = useMinionShell();
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? TriangleAlert : Info;
  const color = toast.tone === 'error' ? '#ef4444' : toast.tone === 'success' ? theme.accent : theme.muted;
  if (toast.matchEvent) return <MatchEventToastView event={toast.matchEvent} maxWidth={maxWidth} onClose={onClose} onPress={toast.onPress} />;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colorScheme === 'dark' ? theme.surfaceMuted : theme.surface, borderColor: theme.border, maxWidth, minWidth: Math.min(384, maxWidth) }]}>
      {toast.character ? (
        <Image
          contentFit="contain"
          source={toast.character === 'attendance' ? require('@/assets/characters/flag-3.png') : require('@/assets/characters/flag-2.png')}
          style={styles.toastCharacter}
        />
      ) : <Icon color={color} size={24} strokeWidth={2.2} />}
      <ToastCopy description={toast.description} title={toast.title} />
      <Pressable accessibilityLabel="알림 닫기" hitSlop={4} onPress={onClose} style={styles.toastClose}><X color={theme.muted} size={16} /></Pressable>
    </View>
  );
}

function ToastViewport({ onClose, toasts }: { onClose: (id: number) => void; toasts: ToastItem[] }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxWidth = width * 0.98;
  if (toasts.length === 0) return null;
  return (
    <View style={[styles.toastWrap, { top: insets.top + 62 }]}>
      {toasts.map((toast) => <ToastItemView key={toast.id} maxWidth={maxWidth} onClose={() => onClose(toast.id)} toast={toast} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { alignItems: 'center', gap: 8, left: '1%', pointerEvents: 'box-none', position: 'absolute', right: '1%', zIndex: 1200 },
  toast: { alignItems: 'center', borderRadius: 16, borderWidth: 1, boxShadow: '0 5px 12px rgba(0,0,0,0.18)', elevation: 8, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  toastCharacter: { height: 40, width: 40 },
  toastClose: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  toastCopy: { flexShrink: 1, minWidth: 0 },
  matchEventBadge: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  matchEventClose: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  matchEventImage: { height: 28, width: 28 },
  matchEventImageKill: { borderRadius: 6 },
  matchEventKind: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
  matchEventMain: { alignItems: 'center', flexDirection: 'row', gap: 8, minWidth: 0 },
  matchEventToast: { alignItems: 'center', borderRadius: 12, borderWidth: 1, boxShadow: '0 5px 12px rgba(0,0,0,0.10)', elevation: 8, flexDirection: 'row', gap: 8, justifyContent: 'space-between', overflow: 'hidden', paddingBottom: 8, paddingLeft: 12, paddingRight: 6, paddingTop: 8 },
  liveDot: { backgroundColor: '#ff3158', borderRadius: 4, height: 8, width: 8 },
});
