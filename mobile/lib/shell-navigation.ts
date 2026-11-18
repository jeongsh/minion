/** Current mobile-web shell routes, translated to Expo's fan route names. */
export type ShellLocalItem = { label: string; href: string; alsoActive?: string };
export type ShellBackRoute = { title: string; href: string; close?: boolean };

export function shellLocalItems(pathname: string, platform: string): ShellLocalItem[] {
  const path = pathname === '/index' ? '/' : pathname;
  const fan = path.match(/^\/fan\/([^/]+)/);
  if (fan) {
    if (/\/community\/(?:new|[^/]+\/new|post\/[^/]+(?:\/edit)?)$/.test(path)) return [];
    const base = `/fan/${fan[1]}`;
    return [
      { label: '홈', href: base },
      { label: '팬톡', href: `${base}/community` },
      { label: '일정', href: `${base}/schedule` },
      { label: '선수', href: `${base}/players` },
      { label: '미디어', href: `${base}/social`, alsoActive: `${base}/videos` },
    ];
  }
  if (/^\/(transfers|news)?$/.test(path)) return [{ label: '홈', href: '/' }, { label: '이적시장', href: '/transfers' }, { label: '뉴스', href: '/news' }];
  if (path === '/predictions/report') return [];
  if (/^\/(schedule|predictions|tournaments)(\/[^/]+)?$/.test(path)) return [
    { label: '일정', href: '/schedule' },
    ...(platform === 'ios' ? [] : [{ label: '승부예측', href: '/predictions' }]),
    { label: '대회', href: '/tournaments' },
  ];
  if (/^\/(players|champions)$/.test(path)) return [{ label: '선수', href: '/players' }, { label: '챔피언', href: '/champions' }];
  return [];
}

export function shellItemActive(pathname: string, item: ShellLocalItem) {
  const path = pathname === '/index' ? '/' : pathname;
  const fanHome = /^\/fan\/[^/]+$/.test(item.href);
  return path === item.href || (!fanHome && item.href !== '/' && path.startsWith(`${item.href}/`))
    || Boolean(item.alsoActive && (path === item.alsoActive || path.startsWith(`${item.alsoActive}/`)));
}

export function shellBackRoute(pathname: string): ShellBackRoute | null {
  if (/^\/matches\/[^/]+$/.test(pathname)) return { title: '경기', href: '/schedule' };
  if (/^\/players\/[^/]+$/.test(pathname)) return { title: '선수', href: '/players' };
  if (/^\/champions\/[^/]+$/.test(pathname)) return { title: '챔피언', href: '/champions' };
  const pages: Record<string, [string, string]> = {
    '/predictions/report': ['내 예측 리포트', '/predictions'],
    '/me': ['마이', '/'], '/me/messages': ['쪽지함', '/me'], '/me/profile': ['프로필 관리', '/me'], '/me/settings': ['설정', '/me'],
    '/teams': ['팀', '/'], '/minicons': ['미니콘', '/'], '/me/minicons': ['내 미니콘', '/minicons'],
    '/minicons/apply': ['미니콘 신청', '/minicons'], '/community/rules': ['커뮤니티 이용 규칙', '/community'],
    '/support': ['고객센터', '/'], '/support/new': ['문의하기', '/support'],
    '/about': ['서비스 소개', '/'], '/policies': ['정책 안내', '/'], '/privacy': ['개인정보처리방침', '/policies'],
    '/terms': ['이용약관', '/policies'], '/advertising': ['광고 및 제휴 문의', '/policies'],
  };
  const page = pages[pathname];
  if (page) return { title: page[0], href: page[1] };
  if (/^\/community\/user\/[^/]+$/.test(pathname)) return { title: '활동', href: '/community' };
  if (/^\/support\/[^/]+$/.test(pathname)) return { title: '문의 상세', href: '/support' };
  return null;
}

export function shellDockActive(pathname: string, href: string) {
  if (href === '/') return /^\/$|^\/index$|^\/(transfers|news)(\/|$)/.test(pathname);
  const fanTalk = /^\/community(?:\/|$)/.test(pathname) || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
  if (href === '/fan') return !fanTalk && (/^\/fan(?:\/|$)/.test(pathname) || pathname === '/teams');
  if (href === '/community') return fanTalk;
  if (href === '/schedule') return /^\/(schedule|matches|tournaments|predictions)(\/|$)/.test(pathname);
  if (href === '/players') return /^\/(players|champions)(\/|$)/.test(pathname);
  return false;
}
