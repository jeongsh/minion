import { useMemo } from 'react';

import { useCachedQuery } from '@/hooks/use-cached-query';
import type { MobileHomeDto } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

// 홈 응답은 공개 캐시라 차단 목록을 반영하지 못한다. 로그인 사용자는 차단한 작성자의 글을 별도로 확인해 숨긴다.
// 차단 시 '/api/mobile/v1/community' 캐시 무효화로 다시 불러온다.
export function useVisibleHomePosts(items: MobileHomeDto['community']) {
  const { session } = useAuth();
  const ids = useMemo(() => items.map((post) => post.id).join(','), [items]);
  const hidden = useCachedQuery<{ postIds: string[] }>(`/api/mobile/v1/community/hidden-posts?ids=${encodeURIComponent(ids)}`, {
    cache: 'memory',
    cacheScope: session?.user.id ?? 'guest',
    enabled: Boolean(session) && ids.length > 0,
    keepPreviousData: true,
  });
  return useMemo(() => {
    const hiddenIds = session ? new Set(hidden.data?.postIds ?? []) : null;
    return hiddenIds && hiddenIds.size > 0 ? items.filter((post) => !hiddenIds.has(post.id)) : items;
  }, [hidden.data, items, session]);
}
