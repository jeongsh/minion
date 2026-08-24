import { SvgUri } from 'react-native-svg';

import { resolveApiAssetUrl } from '@/lib/api-client';

export function ObjectiveIcon({ path, size, opacity = 1 }: { path: string; size: number; opacity?: number }) {
  const uri = resolveApiAssetUrl(path);
  if (!uri) return null;
  return <SvgUri uri={uri} width={size} height={size} opacity={opacity} />;
}
