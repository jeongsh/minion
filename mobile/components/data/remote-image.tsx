import { Image } from 'expo-image';
import ImageIcon from 'lucide-react-native/icons/image';
import { StyleSheet, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';

export function RemoteImage({ url, size = 44, radius = 12 }: { radius?: number; size?: number; url?: string | null }) {
  const { theme } = useMinionTheme();
  const resolvedUrl = resolveApiAssetUrl(url);
  if (!resolvedUrl) return <View style={[styles.fallback, { backgroundColor: theme.surfaceMuted, borderRadius: radius, height: size, width: size }]}><ImageIcon color={theme.muted} size={size * 0.42} /></View>;
  return <Image contentFit="contain" source={{ uri: resolvedUrl }} style={{ backgroundColor: 'transparent', borderRadius: radius, height: size, width: size }} transition={150} />;
}

const styles = StyleSheet.create({ fallback: { alignItems: 'center', justifyContent: 'center' } });
