import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import CheckCircle2 from 'lucide-react-native/icons/circle-check-big';
import Info from 'lucide-react-native/icons/info';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
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
import { Platform, StyleSheet, Text, type TextStyle, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minionRadius, minionSize, minionThemes, type MinionTheme } from '@/constants/minion-theme';
import { getMinionTeam, type MinionTeam } from '@/constants/teams';

const THEME_KEY = 'minion-theme';
const FAVORITE_TEAM_KEY = 'minion-favorite-team';
const PRETENDARD_WEB_STACK = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", sans-serif';
const PAPEROZI_WEB_STACK = 'Paperozi, Pretendard, sans-serif';

type ColorScheme = 'light' | 'dark';
type ToastCharacter = 'attendance' | 'prediction';
type ToastTone = 'success' | 'info' | 'error';
type ToastState = { character?: ToastCharacter; id: number; message: string; tone: ToastTone } | null;

type ShellContextValue = {
  colorScheme: ColorScheme;
  favoriteTeam: MinionTeam | null;
  fonts: { regular: TextStyle; medium: TextStyle; bold: TextStyle; black: TextStyle; display: TextStyle };
  openTeamPicker: () => void;
  setFavoriteTeam: (team: MinionTeam | null) => void;
  setTeamPickerOpen: (open: boolean) => void;
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
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (toastTimer.current) clearTimeout(toastTimer.current);
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

  const showToast = useCallback((message: string, tone: ToastTone = 'info', character?: ToastCharacter) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ character, id: Date.now(), message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

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
    showToast,
    teamPickerOpen,
    theme,
    toggleTheme,
  }), [colorScheme, favoriteTeam, fontsLoaded, openTeamPicker, setFavoriteTeam, showToast, teamPickerOpen, theme, toggleTheme]);

  return (
    <ShellContext.Provider value={value}>
      {children}
      <ToastViewport toast={toast} />
    </ShellContext.Provider>
  );
}

export function useMinionShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useMinionShell must be used inside MinionShellProvider');
  return value;
}

function ToastViewport({ toast }: { toast: ToastState }) {
  const insets = useSafeAreaInsets();
  const { fonts, theme } = useMinionShell();
  if (!toast) return null;
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? TriangleAlert : Info;
  const color = toast.tone === 'error' ? '#ef4444' : theme.accent;
  return (
    <View style={[styles.toastWrap, { top: insets.top + 62 }]}>
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {toast.character ? (
          <Image
            contentFit="contain"
            source={toast.character === 'attendance' ? require('@/assets/characters/flag-3.png') : require('@/assets/characters/flag-2.png')}
            style={styles.toastCharacter}
          />
        ) : <Icon color={color} size={19} strokeWidth={2.2} />}
        <Text style={{ color: theme.text, flex: 1, ...fonts.medium, fontSize: 14 }}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { alignItems: 'center', left: 16, pointerEvents: 'none', position: 'absolute', right: 16, zIndex: 1000 },
  toast: { alignItems: 'center', borderRadius: 14, borderWidth: 1, boxShadow: '0 5px 12px rgba(0,0,0,0.18)', elevation: 8, flexDirection: 'row', gap: 10, maxWidth: 420, paddingHorizontal: 16, paddingVertical: 13, width: '100%' },
  toastCharacter: { height: 36, width: 36 },
});
