import { Tabs } from 'expo-router';

import { MinionDock } from '@/components/minion-dock';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <MinionDock />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: 'absolute' },
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="fan" />
      <Tabs.Screen name="teams" />
      <Tabs.Screen name="news" />
      <Tabs.Screen name="tournaments" options={{ href: null }} />
      <Tabs.Screen name="predictions" options={{ href: null }} />
      <Tabs.Screen name="players" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="matches/[matchId]" options={{ href: null }} />
    </Tabs>
  );
}
