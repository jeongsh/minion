import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import CheckCircle2 from 'lucide-react-native/icons/circle-check-big';
import Info from 'lucide-react-native/icons/info';
import Radio from 'lucide-react-native/icons/radio';
import Star from 'lucide-react-native/icons/star';
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
import { Platform, Pressable, StyleSheet, Text, type TextStyle, useColorScheme, View } from 'react-native';
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
  id: number;
  matchEvent?: MatchEventToast;
  message: string;
  onPress?: () => void;
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
  showToast: (message: string, tone?: ToastTone, character?: ToastCharacter) => void;
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

  const showToast = useCallback((message: string, tone: ToastTone = 'info', character?: ToastCharacter) => {
    enqueueToast({ character, message, tone }, 2600);
  }, [enqueueToast]);

  const showMatchEventToast = useCallback((matchEvent: MatchEventToast, onPress?: () => void) => {
    enqueueToast({ matchEvent, message: '', onPress, tone: 'info' }, 10_000);
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
  const { fonts, theme } = useMinionShell();
  if (kind === 'kill' || kind === 'tower' || kind === 'baron' || kind === 'inhibitor' || kind === 'dragon') return <Sword color={theme.muted} size={16} strokeWidth={2} />;
  if (kind === 'start') return <Radio color={theme.muted} size={15} strokeWidth={2} />;
  if (kind === 'rating') return <Star color={theme.muted} size={15} strokeWidth={2} />;
  if (kind === 'end') return <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 12 }}>END</Text>;
  return null;
}

function MatchEventImage({ kind, src }: { kind: MatchEventToast['kind']; src: string }) {
  const uri = resolveApiAssetUrl(src);
  if (!uri) return null;
  return <Image contentFit={kind === 'kill' ? 'cover' : 'contain'} source={{ uri }} style={[styles.matchEventImage, kind === 'kill' ? styles.matchEventImageKill : null]} />;
}

function MatchEventToastView({ event, onClose, onPress }: { event: MatchEventToast; onClose: () => void; onPress?: () => void }) {
  const { fonts, theme } = useMinionShell();
  const content = (
    <View style={styles.matchEventContent}>
      <View style={styles.matchEventMeta}>
        {event.badge === 'LIVE' ? <View style={styles.liveDot} /> : <Star color={theme.accent} size={13} />}
        <Text style={{ color: event.badge === 'LIVE' ? '#e51643' : theme.accent, ...fonts.medium, fontSize: event.badge === 'LIVE' ? 12 : 13, lineHeight: 17 }}>{event.badge}</Text>
        <Text numberOfLines={1} style={{ color: theme.muted, flex: 1, ...fonts.medium, fontSize: 12, lineHeight: 17 }}>{event.matchup}</Text>
      </View>
      <View style={styles.matchEventMain}>
        <View style={[styles.matchEventSide, styles.matchEventLeft]}>
          <Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 13, lineHeight: 18, textAlign: 'right' }}>{event.leftLabel ?? ''}</Text>
          {event.leftImageSrc ? <MatchEventImage kind={event.kind} src={event.leftImageSrc} /> : null}
        </View>
        <View style={styles.matchEventKind}><MatchEventIcon kind={event.kind} /></View>
        <View style={styles.matchEventSide}>
          {event.rightImageSrc ? <MatchEventImage kind={event.kind} src={event.rightImageSrc} /> : null}
          <Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 13, lineHeight: 18 }}>{event.rightLabel}</Text>
        </View>
      </View>
    </View>
  );
  return (
    <View accessibilityLiveRegion="polite" style={[styles.matchEventToast, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {onPress ? <Pressable accessibilityRole="button" onPress={() => { onClose(); onPress(); }} style={styles.matchEventPressable}>{content}</Pressable> : content}
      <Pressable accessibilityLabel="알림 닫기" hitSlop={4} onPress={onClose} style={styles.matchEventClose}><X color={theme.muted} size={15} /></Pressable>
    </View>
  );
}

function ToastItemView({ onClose, toast }: { onClose: () => void; toast: ToastItem }) {
  const { fonts, theme } = useMinionShell();
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? TriangleAlert : Info;
  const color = toast.tone === 'error' ? '#ef4444' : theme.accent;
  if (toast.matchEvent) return <MatchEventToastView event={toast.matchEvent} onClose={onClose} onPress={toast.onPress} />;
  return (
    <View accessibilityLiveRegion="polite" pointerEvents="none" style={[styles.toast, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {toast.character ? (
        <Image
          contentFit="contain"
          source={toast.character === 'attendance' ? require('@/assets/characters/flag-3.png') : require('@/assets/characters/flag-2.png')}
          style={styles.toastCharacter}
        />
      ) : <Icon color={color} size={19} strokeWidth={2.2} />}
      <Text style={{ color: theme.text, flex: 1, ...fonts.medium, fontSize: 14 }}>{toast.message}</Text>
    </View>
  );
}

function ToastViewport({ onClose, toasts }: { onClose: (id: number) => void; toasts: ToastItem[] }) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View style={[styles.toastWrap, { top: insets.top + 62 }]}>
      {toasts.map((toast) => <ToastItemView key={toast.id} onClose={() => onClose(toast.id)} toast={toast} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { alignItems: 'center', gap: 8, left: 16, pointerEvents: 'box-none', position: 'absolute', right: 16, zIndex: 1200 },
  toast: { alignItems: 'center', borderRadius: 14, borderWidth: 1, boxShadow: '0 5px 12px rgba(0,0,0,0.18)', elevation: 8, flexDirection: 'row', gap: 10, maxWidth: 420, paddingHorizontal: 16, paddingVertical: 13, width: '100%' },
  toastCharacter: { height: 36, width: 36 },
  matchEventClose: { alignItems: 'center', height: 32, justifyContent: 'center', marginLeft: 4, width: 32 },
  matchEventContent: { flex: 1, minWidth: 0 },
  matchEventImage: { height: 24, width: 24 },
  matchEventImageKill: { borderRadius: 6 },
  matchEventKind: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
  matchEventLeft: { justifyContent: 'flex-end' },
  matchEventMain: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4, minWidth: 0 },
  matchEventMeta: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 0 },
  matchEventPressable: { flex: 1, minWidth: 0 },
  matchEventSide: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4, minWidth: 0 },
  matchEventToast: { alignItems: 'center', borderRadius: 12, borderWidth: 1, boxShadow: '0 5px 12px rgba(0,0,0,0.10)', elevation: 8, flexDirection: 'row', maxWidth: 352, paddingBottom: 8, paddingLeft: 12, paddingRight: 6, paddingTop: 8, width: '100%' },
  liveDot: { backgroundColor: '#ff3158', borderRadius: 4, height: 8, width: 8 },
});
