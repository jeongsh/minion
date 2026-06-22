import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamByRouteKey } from "@/lib/team-themes";

type TeamStyle = React.CSSProperties & {
  "--team-primary": string;
  "--team-secondary": string;
};

const fanHeaderItems = [
  { label: "홈", path: "" },
  { label: "뉴스", path: "/news" },
  { label: "경기", path: "/matches" },
  { label: "선수", path: "/players" },
  { label: "커뮤니티", path: "/community" },
  { label: "영상", path: "/videos" },
];

export function FanSiteLayout({
  teamSlug,
  children,
}: {
  teamSlug: string;
  children: React.ReactNode;
}) {
  const team = getTeamByRouteKey(teamSlug);

  if (!team) {
    notFound();
  }

  const style: TeamStyle = {
    "--team-primary": team.primaryColor,
    "--team-secondary": team.secondaryColor,
  };

  return (
    <div className="team-surface min-h-screen bg-[#f6f7fb]" style={style}>
      <header className="sticky top-0 z-30 border-b border-[#e8eaf0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1180px] items-center gap-5 px-5">
          <Link
            href={`/fan/${team.fanSiteHost}`}
            className="flex shrink-0 items-center gap-3"
            aria-label={`${team.shortName} 팬페이지 홈`}
          >
            {team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logoUrl} alt={`${team.name} 로고`} className="h-9 w-20 object-contain" />
            ) : (
              <span className="text-2xl font-black text-accent">{team.shortName}</span>
            )}
          </Link>

          <nav
            aria-label={`${team.name} 팬페이지 메뉴`}
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
          >
            {fanHeaderItems.map((item, index) => (
              <Link
                key={`${item.label}-${item.path}`}
                href={`/fan/${team.fanSiteHost}${item.path}`}
                className={`relative whitespace-nowrap px-3 py-7 text-sm font-black transition-colors hover:text-accent ${
                  index === 0 ? "text-accent" : "text-[#111827]"
                }`}
              >
                {item.label}
                {index === 0 ? (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-accent" />
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <label className="flex h-10 w-44 items-center gap-2 rounded-md border border-[#e0e4eb] bg-white px-3 text-sm text-[#98a2b3] xl:w-52">
              <span className="sr-only">검색</span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
                placeholder="검색어 입력"
              />
              <span aria-hidden="true">⌕</span>
            </label>
            <button
              className="relative h-10 w-10 rounded-md border border-transparent text-lg hover:bg-[#f4f5f8]"
              type="button"
              aria-label="알림"
            >
              !
              <span className="absolute right-1.5 top-1.5 h-4 min-w-4 rounded-full bg-accent px-1 text-[10px] font-black leading-4 text-white">
                1
              </span>
            </button>
            <button
              className="h-10 rounded-md border border-accent px-4 text-sm font-black text-accent hover:bg-[#fff5f7]"
              type="button"
            >
              로그인
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
