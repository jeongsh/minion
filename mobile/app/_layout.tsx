import 'react-native-reanimated';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TeamPickerSheet } from '@/components/team-picker-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { MinionShellProvider } from '@/providers/minion-shell-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MinionShellProvider>
        <RootNavigator />
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
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <TeamPickerSheet />
    </ThemeProvider>
  );
}
