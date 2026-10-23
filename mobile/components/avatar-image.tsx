import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useMinionTheme } from '@/hooks/use-minion-theme';

export function AvatarImage({ uri, radius }: { uri: string; radius: number }) {
  const { theme } = useMinionTheme();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!failed) return;
    const retry = () => { setFailed(false); setAttempt((value) => value + 1); };
    const timer = attempt < 2 ? setTimeout(retry, 1000 * (attempt + 1)) : undefined;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') retry(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [attempt, failed]);
  return <Image key={attempt} cachePolicy={attempt ? 'none' : 'memory-disk'} contentFit="cover" onError={() => { setLoaded(false); setFailed(true); }} onLoad={() => { setLoaded(true); setFailed(false); }} source={{ uri }} style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceMuted, borderRadius: radius, opacity: loaded && !failed ? 1 : 0 }]} />;
}
