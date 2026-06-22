import Link from "next/link";
import { notFound } from "next/navigation";
import { FanPlayerProfiles } from "@/components/fan/fan-player-profiles";
import {
  getAllTeams,
  getMatches,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";
import type { Match, Player, Team } from "@/lib/types";

const POSITION_LABEL: Record<Player["position"], string> = {
  TOP: "TOP",
  JGL: "JUG",
  MID: "MID",
  BOT: "BOT",
  SUP: "SUP",
};

const fanPosts = [
  { board: "응원글", title: "오늘 경기 진짜 멋졌어요", time: "2분 전", likes: 12 },
  { board: "응원글", title: "이번 주도 같이 응원해요", time: "25분 전", likes: 18 },
  { board: "직관후기", title: "첫 직관 다녀온 후기 남겨요", time: "1시간 전", likes: 15 },
  { board: "경기 리뷰", title: "세트 흐름이 너무 좋았던 장면", time: "2시간 전", likes: 24 },
  { board: "입덕/질문", title: "처음 보는 팬을 위한 경기장 팁", time: "2시간 전", likes: 16 },
];

const snsCards = [
  {
    source: "X",
    account: "@TeamOfficial",
    type: "팀 공식",
    title: "오늘의 팀 소식과 현장 사진",
    tone: "dark",
  },
  {
    source: "YouTube",
    account: "@team",
    type: "팀 공식",
    title: "비하인드 스토리와 쇼츠",
    tone: "red",
  },
  {
    source: "Instagram",
    account: "@player",
    type: "선수 공식",
    title: "선수들의 일상과 팬 서비스",
    tone: "pink",
  },
  {
    source: "팬 제보",
    account: "user link",
    type: "팬 제보",
    title: "팬 서포트와 현장 공유",
    tone: "light",
  },
];

const videoCards = [
  { title: "2026 시즌 하이라이트", length: "07:35", meta: "오늘" },
  { title: "비하인드 스토리", length: "08:18", meta: "4일 전" },
  { title: "보이스 콤즈 Ep.2", length: "11:12", meta: "8일 전" },
  { title: "팀 애니메이션", length: "10:05", meta: "10일 전" },
  { title: "경기 후 준비", length: "08:20", meta: "15일 전" },
];

function formatDateTime(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return { date: "-", time: "-" };
  }

  return {
    date: date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }),
    time: date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

function byMatchDate(a: Match, b: Match) {
  return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
}

function teamForMatch(match: Match, team: Team, teams: Team[]) {
  const opponentId = match.teamAId === team.id ? match.teamBId : match.teamAId;
  return teams.find((item) => item.id === opponentId);
}

function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-md border border-border bg-surface shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-xl font-black tracking-normal">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {title}
      </h2>
      {action}
    </div>
  );
}

function TeamLogo({
  team,
  className,
}: {
  team?: Team;
  className: string;
}) {
  if (!team?.logoUrl) {
    return (
      <div className={`${className} flex items-center justify-center rounded-md bg-surface-muted text-sm font-bold`}>
        {team?.shortName ?? "-"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.logoUrl} alt={`${team.name} 로고`} className={`${className} object-contain`} />
  );
}

function Hero({ team }: { team: Team }) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[#1f1f24] bg-[#111] px-6 py-10 text-white shadow-sm md:px-14 md:py-14">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background: `linear-gradient(110deg, #111 0%, ${team.secondaryColor} 42%, ${team.primaryColor} 100%)`,
        }}
      />
      <div className="absolute right-0 top-0 h-full w-3/5 bg-[radial-gradient(circle_at_70%_40%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,transparent_18%,rgba(255,255,255,0.16)_18%,rgba(255,255,255,0.16)_34%,transparent_34%)] opacity-70" />
      <div className="relative z-10 grid gap-8 md:grid-cols-[1fr_0.8fr] md:items-center">
        <div>
          <p className="text-xl font-bold">함께, 더 높이</p>
          <h1 className="mt-4 text-4xl font-black tracking-normal md:text-6xl">
            {team.shortName} 팬 페이지
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/75 md:text-base">
            팬과 함께, 새로운 응원 문화를 만드는 공간
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["#TEAM", "#ONLY", "#FAN", "#WIN"].map((label) => (
              <span
                key={label}
                className="rounded-md border border-accent/60 bg-black/20 px-3 py-1.5 text-xs font-black text-accent"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["응원글 쓰기", "다음 경기", "선수 프로필"].map((label) => (
              <a
                key={label}
                href={`#${label === "응원글 쓰기" ? "fan-feed" : label === "다음 경기" ? "next-match" : "players"}`}
                className="rounded-md border border-white/25 bg-black/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/10"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <TeamLogo team={team} className="h-36 w-52 drop-shadow-2xl md:h-48 md:w-80" />
        </div>
      </div>
    </section>
  );
}

function NextMatchCard({
  team,
  opponent,
  match,
}: {
  team: Team;
  opponent?: Team;
  match?: Match;
}) {
  const schedule = match ? formatDateTime(match.matchDate) : null;

  return (
    <Card id="next-match" className="p-5 md:p-6">
      <SectionTitle title="다음 경기" icon="⚔️" />
      <div className="mt-4 grid gap-5 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-center text-sm font-bold text-muted">
            {match?.name ?? "예정된 경기를 준비 중입니다"}
          </p>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black">{team.shortName}</span>
              <TeamLogo team={team} className="h-14 w-20" />
            </div>
            <span className="text-sm font-bold text-muted">VS</span>
            <div className="flex items-center justify-center gap-3">
              <TeamLogo team={opponent} className="h-14 w-20" />
              <span className="text-2xl font-black">{opponent?.shortName ?? "-"}</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-1">
            <p className="text-sm text-muted">경기 일정</p>
            <p className="mt-1 text-lg font-bold">
              {schedule ? `${schedule.date} ${schedule.time}` : "일정 준비 중"}
            </p>
          </div>
          <div className="md:col-span-1">
            <p className="text-sm text-muted">경기장</p>
            <p className="mt-1 text-lg font-bold">{match?.venue ?? "추후 공개"}</p>
          </div>
          <Link
            href="/schedule"
            className="rounded-md border border-border px-4 py-3 text-center text-sm font-bold hover:bg-surface-muted"
          >
            티켓팅 링크
          </Link>
          <Link
            href={match?.vodUrl ?? "/schedule"}
            className="rounded-md border border-border px-4 py-3 text-center text-sm font-bold hover:bg-surface-muted"
          >
            중계 링크
          </Link>
          <Link
            href={match ? `/matches/${match.id}` : "/schedule"}
            className="rounded-md border border-accent px-4 py-3 text-center text-sm font-bold text-accent hover:bg-surface-muted md:col-span-2"
          >
            경기 상세 보기
          </Link>
        </div>
      </div>
    </Card>
  );
}
function CalendarCard({
  matches,
  focusDate,
}: {
  matches: Match[];
  focusDate?: string;
}) {
  const calendarDate = new Date(focusDate ?? "2026-06-01T00:00:00+09:00");
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const matchDays = new Set(
    matches
      .filter((match) => {
        const date = new Date(match.matchDate);
        return date.getFullYear() === year && date.getMonth() === month;
      })
      .map((match) => new Date(match.matchDate).getDate()),
  );
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <Card className="p-5">
      <SectionTitle
        title="캘린더"
        icon="🗓️"
        action={<Link href="/schedule" className="text-sm font-bold text-accent">전체 보기</Link>}
      />
      <div className="mt-4 flex items-center justify-between">
        <p className="text-lg font-black">{year}년 {month + 1}월</p>
        <Link href="/schedule" className="rounded-md border border-border px-3 py-2 text-sm font-bold hover:bg-surface-muted">
          크게 보기
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border text-center text-sm">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <div key={day} className="bg-surface-muted py-2 font-bold">{day}</div>
        ))}
        {cells.map((day, index) => (
          <div
            key={`${day ?? "blank"}-${index}`}
            className={`min-h-12 bg-surface p-2 ${day && matchDays.has(day) ? "text-accent" : ""}`}
          >
            {day ? (
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <span className="font-bold">{day}</span>
                {matchDays.has(day) ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <span className="rounded-md bg-surface-muted px-3 py-2 font-bold">경기 일정</span>
        <span className="rounded-md bg-surface-muted px-3 py-2 font-bold text-muted">기념일 준비 중</span>
        <span className="rounded-md bg-surface-muted px-3 py-2 font-bold text-muted">데뷔일 준비 중</span>
      </div>
    </Card>
  );
}

function FanFeedCard() {
  const boards = ["응원글", "직관후기", "경기 리뷰", "입덕/질문", "자유게시판"];

  return (
    <Card id="fan-feed" className="p-5">
      <SectionTitle title="팬 활동 피드" icon="💬" />
      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-border">
        {boards.map((board, index) => (
          <button
            key={board}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-bold ${
              index === 0 ? "border-accent text-accent" : "border-transparent text-muted"
            }`}
            type="button"
          >
            {board}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {fanPosts.map((post) => (
          <div key={post.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
            <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-bold text-accent">{post.board}</span>
            <p className="truncate font-semibold">{post.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{post.time}</span>
              <span>좋아요 {post.likes}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-5 w-full rounded-md border border-accent px-4 py-3 text-sm font-bold text-accent hover:bg-surface-muted" type="button">
        글쓰기
      </button>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlayerProfiles({ players }: { players: Player[] }) {
  return (
    <Card id="players" className="p-5">
      <SectionTitle
        title="선수 프로필"
        icon="🧸"
        action={<Link href="#players" className="rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent">선수 전체 보기</Link>}
      />
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {players.slice(0, 5).map((player) => (
          <Link
            key={player.id}
            href={`/players/${player.slug}`}
            className="overflow-hidden rounded-md border border-border bg-background transition hover:border-accent"
          >
            <div className="relative aspect-[4/5] bg-surface-muted">
              {player.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.profileImageUrl} alt={player.name} className="h-full w-full object-cover object-top" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg font-black text-muted">{player.name.slice(0, 2)}</div>
              )}
              <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-black text-accent">
                {POSITION_LABEL[player.position]}
              </span>
            </div>
            <div className="p-3 text-center">
              <p className="truncate text-sm font-black">{player.name}</p>
              <p className="mt-1 text-xs text-muted">{player.realName || "프로필 준비 중"}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function AdBanner({
  title,
  helper,
}: {
  title: string;
  helper: string;
}) {
  return (
    <section className="rounded-md border border-pink-100 bg-[linear-gradient(110deg,#ffe5ec,#fff,#ffd6e2)] px-6 py-6 text-center shadow-sm">
      <p className="text-xs font-bold text-accent">광고</p>
      <p className="mt-2 text-xl font-black text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted">{helper}</p>
    </section>
  );
}

function SnsSection({ team }: { team: Team }) {
  return (
    <Card className="p-5">
      <SectionTitle
        title="SNS 모아보기"
        icon="👩‍🚀"
        action={<Link href={`/fan/${team.fanSiteHost}/news`} className="rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent">전체 SNS 보기</Link>}
      />
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {snsCards.map((card) => (
          <article key={card.source} className="rounded-md border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{card.source}</p>
                <p className="text-xs text-muted">{card.account}</p>
              </div>
              <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-bold text-accent">{card.type}</span>
            </div>
            <p className="mt-4 min-h-12 text-sm font-semibold">{card.title}</p>
            <div
              className={`mt-4 flex aspect-[16/9] items-center justify-center rounded-md text-center text-lg font-black text-white ${
                card.tone === "dark"
                  ? "bg-[#151515]"
                  : card.tone === "red"
                    ? "bg-[linear-gradient(135deg,#7a0618,#f43f5e)]"
                    : card.tone === "pink"
                      ? "bg-[linear-gradient(135deg,#ff7ab6,#ffd1df)]"
                      : "bg-[linear-gradient(135deg,#f7b4c6,#fff)] text-accent"
              }`}
            >
              {card.source}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

function VideoSection({ team }: { team: Team }) {
  return (
    <Card className="p-5">
      <SectionTitle
        title="영상 모아보기"
        icon="🦋"
        action={<Link href={`/fan/${team.fanSiteHost}/news`} className="rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent">전체 영상 보기</Link>}
      />
      <div className="mt-4 grid gap-4 md:grid-cols-5">
        {videoCards.map((video, index) => (
          <article key={video.title} className="min-w-0">
            <div
              className={`relative aspect-video rounded-md ${
                index % 2 === 0
                  ? "bg-[linear-gradient(135deg,#111,#7f1020)]"
                  : "bg-[linear-gradient(135deg,#2b0a12,#fb7185)]"
              }`}
            >
              <div className="flex h-full items-center justify-center p-3 text-center text-lg font-black text-white">
                {video.title}
              </div>
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs font-bold text-white">
                {video.length}
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-bold">{video.title}</p>
            <p className="text-xs text-muted">{video.meta}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

function OfficialLinks({ team }: { team: Team }) {
  const links = [
    { label: "공식 홈페이지", href: team.officialHomepageUrl },
    { label: "유튜브", href: team.officialYoutubeUrl },
    { label: "X", href: team.officialXUrl },
    { label: "인스타그램", href: team.officialInstagramUrl },
    { label: "LCK 팀 상세", href: `/teams/${team.slug}` },
  ];

  return (
    <Card className="p-5">
      <SectionTitle title="팀 정보 / 공식 링크" icon="💗" />
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="rounded-md border border-border bg-background px-4 py-3 text-sm font-bold hover:border-accent hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default async function FanHomePage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const [teams, players, matches] = await Promise.all([getAllTeams(), getPlayers(), getMatches()]);
  const teamPlayers = players
    .filter((player) => player.teamId === team.id)
    .sort((a, b) => Object.keys(POSITION_LABEL).indexOf(a.position) - Object.keys(POSITION_LABEL).indexOf(b.position));
  const teamMatches = matches
    .filter((match) => match.teamAId === team.id || match.teamBId === team.id)
    .sort(byMatchDate);
  const upcomingMatch =
    teamMatches.find((match) => match.status === "live") ??
    teamMatches.find((match) => match.status === "scheduled") ??
    [...teamMatches].reverse()[0];
  const opponent = upcomingMatch ? teamForMatch(upcomingMatch, team, teams) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-6">
      <Hero team={team} />
      <NextMatchCard team={team} opponent={opponent} match={upcomingMatch} />
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.35fr]">
        <CalendarCard matches={teamMatches} focusDate={upcomingMatch?.matchDate ?? teamMatches[0]?.matchDate} />
        <FanFeedCard />
      </div>
      <AdBanner title={`${team.shortName}과 함께, 일상을 더 특별하게`} helper="광고 영역" />
      <FanPlayerProfiles players={teamPlayers} />
      <SnsSection team={team} />
      <AdBanner title={`${team.shortName} 굿즈로 완성하는 나만의 응원 스타일`} helper="광고 영역" />
      <VideoSection team={team} />
      <OfficialLinks team={team} />
    </main>
  );
}
