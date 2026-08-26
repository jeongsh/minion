import { Redirect, useLocalSearchParams } from 'expo-router';

export default function FanCommunityLegacyBoardRoute() {
  const params = useLocalSearchParams<{ team?: string | string[] }>();
  const teamSlug = Array.isArray(params.team) ? params.team[0] : params.team;
  return <Redirect href={teamSlug ? `/fan/${teamSlug}/community` : '/fan'} />;
}
