import { useEffect, useRef, useState } from 'react';
import { fetchMobileQuery, type MobileTeamDetailDto } from '@/lib/api-client';
import { useMinionTheme } from '@/hooks/use-minion-theme';

type Page = { matches: MobileTeamDetailDto['matches']; events: MobileTeamDetailDto['calendarEvents'] };
export function useTeamCalendar(teamSlug: string, initial: Page) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const { showToast } = useMinionTheme();
  useEffect(() => () => { request.current++; }, []);
  async function load(month: string) {
    const version = ++request.current;
    setLoading(true);
    try {
      const path = `/api/mobile/v1/teams/${encodeURIComponent(teamSlug)}/calendar?month=${month}`;
      const next = await fetchMobileQuery<Page>(path, path, true, false);
      if (version !== request.current) return false;
      setData(next);
      return true;
    } catch (caught) {
      if (version === request.current) showToast(caught instanceof Error ? caught.message : '일정을 불러오지 못했습니다.', 'error');
      return false;
    } finally { if (version === request.current) setLoading(false); }
  }
  return { data, loading, load };
}
