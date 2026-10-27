import { useEffect, useRef, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';

import { useCachedQuery } from '@/hooks/use-cached-query';
import { useMinionTheme } from '@/hooks/use-minion-theme';

/** Read-only screens opt in; editing forms keep useCachedQuery. */
export function useScreenQuery<T>(path: string, options: Parameters<typeof useCachedQuery<T>>[1] = {}) {
  const query = useCachedQuery<T>(path, { refreshOnFocus: true, ...options });
  const { theme, showToast } = useMinionTheme();
  const pulled = useRef(false);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    if (query.refreshing || !pulled.current) return;
    pulled.current = false;
    setPulling(false);
    if (query.error) showToast(query.error);
  }, [query.error, query.refreshing, showToast]);

  const refreshControl = <RefreshControl
    accessibilityLabel="새로고침"
    colors={[Platform.OS === 'android' ? theme.accent : 'transparent']}
    tintColor="transparent"
    progressBackgroundColor={Platform.OS === 'android' ? theme.surface : 'transparent'}
    // RN 0.81 accepts 'large'; its bundled declaration still specifies number.
    size={'large' as unknown as number}
    refreshing={pulling}
    onRefresh={() => {
      pulled.current = true;
      setPulling(true);
      query.refresh();
    }}
  />;
  return { ...query, refreshControl };
}
