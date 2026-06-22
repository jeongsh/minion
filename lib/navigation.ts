export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const hubNavItems: NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/schedule", label: "일정" },
  { href: "/standings", label: "순위" },
  { href: "/teams", label: "팀" },
  { href: "/players", label: "선수" },
  { href: "/stats", label: "스탯" },
  { href: "/community", label: "커뮤니티" },
  { href: "/admin", label: "관리" },
];

export const statsNavItems: NavItem[] = [
  { href: "/stats/teams", label: "팀 스탯" },
  { href: "/stats/players", label: "선수 스탯" },
  { href: "/stats/champions", label: "챔피언/밴픽" },
  { href: "/stats/form", label: "최근 폼" },
  { href: "/stats/fan-ratings", label: "팬 평점" },
  { href: "/stats/pom", label: "공식 POM" },
];

export const communityNavItems: NavItem[] = [
  { href: "/community/reviews", label: "경기 리뷰" },
  { href: "/community/draft", label: "밴픽 토론" },
  { href: "/community/issues", label: "LCK 이슈" },
  { href: "/community/free", label: "자유 게시판" },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin/matches", label: "경기 관리" },
  { href: "/admin/sets", label: "세트 관리" },
  { href: "/admin/stats", label: "스탯 입력" },
  { href: "/admin/champions", label: "챔피언 관리" },
  { href: "/admin/international-teams", label: "해외팀 관리" },
  { href: "/admin/teams", label: "팀 관리" },
  { href: "/admin/players", label: "선수 관리" },
  { href: "/admin/ratings", label: "팬 평점 관리" },
  { href: "/admin/fan-sites", label: "팬 사이트 설정" },
  { href: "/admin/news", label: "소식 관리" },
  { href: "/admin/scripts", label: "스크립트 실행" },
];

export function fanNavItems(teamSlug: string): NavItem[] {
  return [
    { href: `/fan/${teamSlug}`, label: "홈" },
    { href: `/fan/${teamSlug}/news`, label: "소식" },
    { href: `/fan/${teamSlug}/players`, label: "선수" },
    { href: `/fan/${teamSlug}/matches`, label: "경기" },
    { href: `/fan/${teamSlug}/community`, label: "커뮤니티" },
    { href: `/fan/${teamSlug}/info`, label: "정보" },
  ];
}

export function fanCommunityNavItems(teamSlug: string): NavItem[] {
  return [
    { href: `/fan/${teamSlug}/community/free`, label: "자유" },
    { href: `/fan/${teamSlug}/community/cheer`, label: "응원" },
    { href: `/fan/${teamSlug}/community/reviews`, label: "경기 후기" },
    { href: `/fan/${teamSlug}/community/draft`, label: "밴픽 토론" },
    { href: `/fan/${teamSlug}/community/players`, label: "선수 이야기" },
  ];
}
