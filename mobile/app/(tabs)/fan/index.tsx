import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { MinionScreen } from '@/components/minion-screen';
import { useMinionTheme } from '@/hooks/use-minion-theme';

export default function FanLandingScreen() {
  const router = useRouter();
  const { favoriteTeam, openTeamPicker } = useMinionTheme();

  useEffect(() => {
    if (favoriteTeam) router.replace(`/fan/${favoriteTeam.slug}` as never);
    else openTeamPicker();
  }, [favoriteTeam, openTeamPicker, router]);

  return <MinionScreen />;
}
