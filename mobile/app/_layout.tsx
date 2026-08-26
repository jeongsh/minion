import 'react-native-reanimated';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';

import { TeamPickerSheet } from '@/components/team-picker-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { MinionShellProvider } from '@/providers/minion-shell-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { InAppNotificationsProvider } from '@/providers/in-app-notifications-provider';
import { minionTeams } from '@/constants/teams';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MinionShellProvider>
        <AuthProvider>
          <InAppNotificationsProvider>
            <RootNavigator />
          </InAppNotificationsProvider>
        </AuthProvider>
      </MinionShellProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { colorScheme, theme } = useMinionTheme();
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          background: theme.pageBackground,
          card: theme.surface,
          border: theme.divider,
          primary: theme.accent,
          text: theme.text,
        },
      }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="favorite-team" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="me" />
        <Stack.Screen name="me/profile" />
        <Stack.Screen name="me/settings" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <TeamPickerSheet />
      <AccountShellSync />
    </ThemeProvider>
  );
}

function AccountShellSync() {
  const { loading, session, viewer } = useAuth();
  const { setFavoriteTeam } = useMinionTheme();
  useEffect(() => {
    if (loading) return;
    if (!session) {
      setFavoriteTeam(null);
      return;
    }
    if (viewer) setFavoriteTeam(minionTeams.find((team) => team.slug === viewer.favoriteTeamSlug) ?? null);
  }, [loading, session, setFavoriteTeam, viewer]);
  return null;
}
