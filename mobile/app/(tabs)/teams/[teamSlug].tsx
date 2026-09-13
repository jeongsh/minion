import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TeamDetailScreen() {
  const params = useLocalSearchParams<{ teamSlug?: string | string[] }>();
  const team = Array.isArray(params.teamSlug) ? params.teamSlug[0] : params.teamSlug;
  return <Redirect href={team ? { pathname: '/teams', params: { team } } : '/teams'} />;
}
