import { useEffect, useRef, useState } from 'react';
import { fetchMobileQuery, type MobileTeamDetailDto } from '@/lib/api-client';
import { useMinionTheme } from '@/hooks/use-minion-theme';

export function useFanMedia(initial: MobileTeamDetailDto, teamSlug: string, section: 'social' | 'videos') {
  const { showToast } = useMinionTheme();
  const [page, setPage] = useState(initial);
  const [owner, setOwner] = useState('all');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const busy = useRef(false);
  useEffect(() => () => { request.current++; }, []);

  async function load(nextOwner: string, append: boolean) {
    if (append && (busy.current || !page.media?.nextCursor)) return;
    const version = ++request.current;
    busy.current = true;
    setLoading(true);
    try {
      const query = new URLSearchParams({ section, view: 'paged', owner: nextOwner });
      if (append) query.set('cursor', page.media!.nextCursor!);
      const path = `/api/mobile/v1/teams/${encodeURIComponent(teamSlug)}?${query}`;
      const next = await fetchMobileQuery<MobileTeamDetailDto>(path, path, true, false);
      if (version !== request.current) return;
      setPage(previous => append ? {
        ...next,
        social: [...new Map([...previous.social, ...next.social].map(item => [item.id, item])).values()],
        videos: [...new Map([...previous.videos, ...next.videos].map(item => [item.id, item])).values()],
      } : next);
      setOwner(nextOwner);
    } catch (error) {
      if (version === request.current) showToast(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.', 'error');
    } finally {
      if (version === request.current) { busy.current = false; setLoading(false); }
    }
  }
  return { page, paging: { owner, loading, tabs: page.media?.tabs ?? [], hasMore: Boolean(page.media?.nextCursor), onOwner: (value: string) => void load(value, false), onMore: () => void load(owner, true) } };
}

export type FanMediaPaging = ReturnType<typeof useFanMedia>['paging'];
