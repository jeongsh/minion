import Link from "next/link";
import { BarChart3, CalendarDays, Flame, NotebookPen, ShieldBan, Sparkles, TrendingUp, Trophy } from "lucide-react";
import type { WeeklyReportSummary } from "@/lib/reports/queries";
import type { ReportChampionStat, ReportTeamRef, WeeklyReportRow } from "@/lib/reports/types";

const POSITION_LABELS: Record<string, string> = { TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서포터" };
const TIER_ROWS = [
  { key: "sTier", label: "S" },
  { key: "aTier", label: "A" },
  { key: "bTier", label: "B" },
] as const;

function pct(rate: number) {
  return Math.round(rate * 100);
}

function formatPeriod(start: string, end: string) {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return `${sm}월 ${sd}일 – ${em}월 ${ed}일`;
}

function formatMatchDay(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function TeamLogo({ team, size = "h-9 w-9" }: { team: ReportTeamRef | null; size?: string }) {
  if (!team?.logoUrl) {
    return <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-xs font-black text-[var(--ui-muted)]`}>{team?.shortName?.slice(0, 1) ?? "?"}</span>;
  }
  if (team.logoWhiteUrl) {
    return (
      <span className={`relative ${size} shrink-0`}>
        <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain dark:hidden" />
        <img src={team.logoWhiteUrl} alt="" aria-hidden="true" className="hidden h-full w-full object-contain dark:block" />
      </span>
    );
  }
  return <img src={team.logoUrl} alt={team.name} className={`${size} shrink-0 object-contain`} />;
}

function ChampionFace({ champion, size = "h-10 w-10" }: { champion: ReportChampionStat | undefined; size?: string }) {
  if (!champion) return null;
  return champion.imageUrl ? (
    <img src={champion.imageUrl} alt={champion.name} className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <span className={`grid ${size} shrink-0 place-items-center rounded-xl bg-[var(--ui-surface-muted)] text-xs font-black text-[var(--ui-muted)]`}>{champion.name.slice(0, 2)}</span>
  );
}

function SectionHead({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }) {
  return (
    <div className="mb-6">
      <p className="font-archivo text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--ui-muted)]">{eyebrow}</p>
      <div className="mt-1.5 flex items-center gap-2.5 border-b-2 border-[var(--ui-ink)] pb-3">
        <Icon size={22} className="text-[var(--ui-ink)]" />
        <h2 className="home-section-title text-[22px] text-[var(--ui-ink)]">{title}</h2>
      </div>
    </div>
  );
}

// 종합 점수(밴픽률 30% + 보정승률 40% + 스탯 30%, 0~100) 배지.
// 구버전 리포트(score 없음)는 승률 표기로 대체한다.
function ScoreBadge({ stat }: { stat: ReportChampionStat }) {
  if (stat.score == null) {
    return <span className="rounded-md bg-[var(--ui-surface-muted)] px-1.5 py-0.5 font-archivo text-[11px] font-extrabold text-[var(--ui-muted)]">{pct(stat.winRate)}%</span>;
  }
  const breakdown = `밴픽률 ${pct(stat.presenceRate)}% · 승률 ${pct(stat.winRate)}% · 스탯 ${stat.statScore ?? "-"}점`;
  const strong = stat.score >= 75;
  return (
    <span title={breakdown} className={`rounded-md px-1.5 py-0.5 text-[11px] font-extrabold ${strong ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--ui-ink)]" : "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"}`}>
      종합 <span className="font-archivo">{stat.score}</span>
    </span>
  );
}

export function WeeklyReportView({ report, index }: { report: WeeklyReportRow; index: WeeklyReportSummary[] }) {
  const content = report.content;
  const { stats, review, meta, preview } = content;
  const championBySlug = new Map(stats.champions.map((champion) => [champion.slug, champion]));
  const weekNumber = report.week_key.split("-W")[1] ?? report.week_key;
  const presenceTop = [...stats.champions].sort((a, b) => b.presenceRate - a.presenceRate).slice(0, 5);
  const banSpotlightChampion = meta.banSpotlight ? championBySlug.get(meta.banSpotlight.championSlug) : undefined;
  const generatedAt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" }).format(new Date(report.generated_at));

  return (
    <div className="mx-auto w-full max-w-[1080px] px-[var(--page-inline)] pb-24 pt-8">
      {/* 아카이브 */}
      {index.length > 1 && (
        <nav className="mb-5 flex flex-wrap items-center gap-2">
          {index.map((item) => {
            const active = item.week_key === report.week_key;
            const number = item.week_key.split("-W")[1] ?? item.week_key;
            return (
              <Link
                key={item.week_key}
                href={`/reports/${item.week_key}`}
                className={`rounded-full border px-3.5 py-1.5 font-archivo text-xs font-extrabold tracking-wide transition ${
                  active
                    ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                    : "border-[var(--ui-border)] text-[var(--ui-muted)] hover:border-[var(--ui-ink)] hover:text-[var(--ui-ink)]"
                }`}
              >
                W{number}
              </Link>
            );
          })}
        </nav>
      )}

      {/* 커버 */}
      <header
        className="relative overflow-hidden rounded-2xl bg-[#141517] px-7 py-10 text-white sm:px-12 sm:py-14"
        style={{ backgroundImage: "radial-gradient(820px 300px at 88% -10%, rgb(71 229 11 / 0.22), transparent 62%), radial-gradient(560px 260px at -6% 110%, rgb(71 229 11 / 0.1), transparent 60%)" }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-archivo text-[11px] font-black uppercase tracking-[0.3em] text-[#47e50b]">Minion Weekly Report</span>
          <span className="font-archivo text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{report.week_key}</span>
        </div>
        <p className="mt-6 font-archivo text-sm font-extrabold uppercase tracking-[0.14em] text-white/60">
          {formatPeriod(report.period_start, report.period_end)} · LCK
        </p>
        <h1 className="home-section-title mt-3 max-w-[760px] text-[clamp(28px,4.6vw,44px)] leading-[1.25] text-white">{content.headline}</h1>
        <p className="mt-4 max-w-[640px] text-[15px] font-semibold leading-relaxed text-white/70">{content.subtitle}</p>
        <dl className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "경기", value: `${stats.matchCount}` },
            { label: "세트", value: `${stats.setCount}` },
            { label: "평균 경기 시간", value: stats.avgGameMinutes ? `${stats.avgGameMinutes}분` : "—" },
            { label: "패치", value: stats.patches.join(", ") || "—" },
          ].map((chip) => (
            <div key={chip.label} className="rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3">
              <dt className="text-[11px] font-bold text-white/50">{chip.label}</dt>
              <dd className="mt-1 font-archivo text-xl font-black tracking-tight">{chip.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* 총평 */}
      <section className="mt-14">
        <SectionHead eyebrow="Overview" title="위클리 브리핑" icon={NotebookPen} />
        <div className="max-w-[760px] space-y-4 text-[16px] font-medium leading-[1.85] text-[var(--ui-text)]">
          {content.overview.map((paragraph, orderIndex) => (
            <p key={orderIndex}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* 주간 결과 */}
      <section className="mt-14">
        <SectionHead eyebrow="Results" title="이번 주 결과" icon={CalendarDays} />
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.matches.map((match) => {
            const aWin = match.winnerSlug != null && match.winnerSlug === match.teamA?.slug;
            const bWin = match.winnerSlug != null && match.winnerSlug === match.teamB?.slug;
            return (
              <article key={match.matchId} className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-4">
                <p className="text-xs font-bold text-[var(--ui-muted)]">{formatMatchDay(match.date)}{match.tournament ? ` · ${match.tournament}` : ""}</p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className={`flex min-w-0 items-center gap-2.5 ${aWin ? "" : "opacity-55"}`}>
                    <TeamLogo team={match.teamA} />
                    <b className="min-w-0 truncate text-[15px] text-[var(--ui-ink)]">{match.teamA?.shortName ?? "TBD"}</b>
                  </div>
                  <strong className="font-archivo text-xl font-black tracking-tight text-[var(--ui-ink)]">
                    {match.scoreA}<span className="mx-1 text-[var(--ui-muted)]">:</span>{match.scoreB}
                  </strong>
                  <div className={`flex min-w-0 flex-row-reverse items-center gap-2.5 ${bWin ? "" : "opacity-55"}`}>
                    <TeamLogo team={match.teamB} />
                    <b className="min-w-0 truncate text-[15px] text-[var(--ui-ink)]">{match.teamB?.shortName ?? "TBD"}</b>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 위클리 스포트라이트 */}
      <section className="mt-14">
        <SectionHead eyebrow="Spotlight" title="이번 주의 팀 & 선수" icon={Trophy} />
        {review.teamOfWeek.team && (
          <article
            className="relative overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 sm:p-8"
            style={{ backgroundImage: `radial-gradient(640px 220px at 100% 0%, color-mix(in srgb, ${review.teamOfWeek.team.color} 14%, transparent), transparent 65%)` }}
          >
            <p className="font-archivo text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: review.teamOfWeek.team.color }}>Team of the Week</p>
            <div className="mt-4 flex items-start gap-5">
              <TeamLogo team={review.teamOfWeek.team} size="h-16 w-16" />
              <div className="min-w-0">
                <h3 className="text-xl font-black tracking-tight text-[var(--ui-ink)]">{review.teamOfWeek.team.name}</h3>
                <p className="mt-1 text-sm font-bold text-[var(--ui-muted)]">{review.teamOfWeek.title}</p>
                <p className="mt-3 max-w-[680px] text-[16px] font-medium leading-[1.8] text-[var(--ui-text)]">{review.teamOfWeek.body}</p>
              </div>
            </div>
          </article>
        )}
        {review.playersOfWeek.length > 0 && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {review.playersOfWeek.map((player) => (
              <article key={player.playerName} className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
                <div className="flex items-center gap-3">
                  {player.playerImageUrl ? (
                    <img src={player.playerImageUrl} alt={player.playerName} className="h-12 w-12 rounded-full bg-[var(--ui-surface-muted)] object-cover object-top" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--ui-surface-muted)] font-archivo text-sm font-black text-[var(--ui-muted)]">{player.playerName.slice(0, 2)}</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-black text-[var(--ui-ink)]">
                      {player.playerSlug ? <Link href={`/players/${player.playerSlug}`} className="hover:underline">{player.playerName}</Link> : player.playerName}
                    </p>
                    <p className="text-xs font-bold text-[var(--ui-muted)]">
                      {player.team?.shortName ?? ""} · {POSITION_LABELS[player.position] ?? player.position}
                    </p>
                  </div>
                </div>
                {player.championNames.length > 0 && (
                  <p className="mt-3 text-[12px] font-bold text-[var(--ui-muted)]">이번 주 챔피언 — {player.championNames.join(" · ")}</p>
                )}
                <p className="mt-2.5 text-[14px] font-medium leading-[1.75] text-[var(--ui-text)]">{player.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 메타 리포트 */}
      <section className="mt-14">
        <SectionHead eyebrow="Meta Report" title="이번 주 메타" icon={TrendingUp} />
        <div className="max-w-[760px] space-y-4 text-[16px] font-medium leading-[1.85] text-[var(--ui-text)]">
          {meta.summary.map((paragraph, orderIndex) => (
            <p key={orderIndex}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          {/* 프레즌스 상위 */}
          <article className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6">
            <h3 className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-muted)]">밴픽률 TOP 5</h3>
            <ul className="mt-5 space-y-3.5">
              {presenceTop.map((champion) => (
                <li key={champion.slug} className="flex items-center gap-3">
                  <ChampionFace champion={champion} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-black text-[var(--ui-ink)]">{champion.name}</span>
                      <span className="shrink-0 text-[12px] font-bold text-[var(--ui-muted)]">
                        픽 {champion.picks}·밴 {champion.bans} · 승률 {pct(champion.winRate)}%{champion.score != null ? ` · 종합 ${champion.score}점` : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
                      <span className="block h-full rounded-full bg-[var(--ui-ink)]" style={{ width: `${Math.min(100, pct(champion.presenceRate))}%` }} />
                    </div>
                  </div>
                  <span className="w-12 shrink-0 text-right">
                    <span className="block font-archivo text-[13px] font-black leading-tight text-[var(--ui-ink)]">{pct(champion.presenceRate)}%</span>
                    <span className="block text-[10px] font-bold text-[var(--ui-muted)]">밴픽률</span>
                  </span>
                </li>
              ))}
            </ul>
          </article>

          {/* 밴 스포트라이트 */}
          {meta.banSpotlight && banSpotlightChampion && (
            <article className="flex flex-col justify-between rounded-2xl bg-[#18191c] p-6 text-white" style={{ backgroundImage: "radial-gradient(420px 200px at 100% 0%, rgb(255 49 88 / 0.18), transparent 60%)" }}>
              <div>
                <h3 className="flex items-center gap-2 font-archivo text-[12px] font-extrabold uppercase tracking-[0.18em] text-white/55"><ShieldBan size={15} />This Week&apos;s Ban Target</h3>
                <div className="mt-5 flex items-center gap-4">
                  {banSpotlightChampion.imageUrl && <img src={banSpotlightChampion.imageUrl} alt={banSpotlightChampion.name} className="h-16 w-16 rounded-2xl object-cover" />}
                  <div>
                    <p className="text-xl font-black tracking-tight">{banSpotlightChampion.name}</p>
                    <p className="mt-1 font-archivo text-[12px] font-extrabold text-white/60">밴 {banSpotlightChampion.bans}회 · 밴픽률 {pct(banSpotlightChampion.presenceRate)}%</p>
                  </div>
                </div>
                <p className="mt-4 text-[14px] font-medium leading-[1.75] text-white/75">{meta.banSpotlight.comment}</p>
              </div>
            </article>
          )}
        </div>

        {/* 포지션별 티어 */}
        <div className="mt-6 space-y-4">
          {meta.positions.map((position) => {
            const risingChampion = position.rising ? championBySlug.get(position.rising) : undefined;
            const hasTiers = TIER_ROWS.some((tier) => position[tier.key].length > 0);
            if (!hasTiers && !position.comment) return null;
            return (
              <article key={position.position} className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-archivo text-lg font-black uppercase tracking-[0.08em] text-[var(--ui-ink)]">{position.position}</h3>
                  <span className="text-sm font-bold text-[var(--ui-muted)]">{POSITION_LABELS[position.position]}</span>
                  {risingChampion && (
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 py-1 text-[11.5px] font-black text-[var(--ui-ink)]">
                      <TrendingUp size={13} />라이징 · {risingChampion.name}
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-2.5">
                  {TIER_ROWS.map((tier) => {
                    const slugs = position[tier.key];
                    if (slugs.length === 0) return null;
                    return (
                      <div key={tier.key} className="flex items-start gap-3">
                        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl font-archivo text-[15px] font-black ${
                          tier.label === "S" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : tier.label === "A" ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]" : "border border-[var(--ui-border)] text-[var(--ui-muted)]"
                        }`}>{tier.label}</span>
                        <div className="flex flex-wrap gap-2">
                          {slugs.map((slug) => {
                            const champion = championBySlug.get(slug);
                            if (!champion) return null;
                            return (
                              <span key={slug} className="flex items-center gap-2 rounded-xl border border-[var(--ui-border)] py-1.5 pl-1.5 pr-2.5">
                                <ChampionFace champion={champion} size="h-8 w-8" />
                                <span className="text-[13px] font-extrabold text-[var(--ui-ink)]">{champion.name}</span>
                                <ScoreBadge stat={champion} />
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {position.comment && <p className="mt-4 border-t border-[var(--ui-border)] pt-3.5 text-[14px] font-medium leading-[1.75] text-[var(--ui-text)]">{position.comment}</p>}
              </article>
            );
          })}
        </div>

        {(meta.sources?.length ?? 0) > 0 && (
          <p className="mt-5 text-[12px] font-semibold leading-relaxed text-[var(--ui-muted)]">
            참고 자료 —{" "}
            {meta.sources!.map((source, orderIndex) => (
              <span key={source.url}>
                {orderIndex > 0 && " · "}
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ui-ink)]">{source.title}</a>
              </span>
            ))}
          </p>
        )}
      </section>

      {/* 데이터 하이라이트 */}
      <section className="mt-14">
        <SectionHead eyebrow="Data Highlights" title="이번 주 기록" icon={BarChart3} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.statLeaders.map((leader) => (
            <article key={leader.key} className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
              <p className="text-xs font-extrabold text-[var(--ui-muted)]">{leader.label}</p>
              <p className="mt-2.5 font-archivo text-[34px] font-black leading-none tracking-tight text-[var(--ui-ink)]">
                {leader.value}<span className="ml-1.5 text-sm font-extrabold text-[var(--ui-muted)]">{leader.unit}</span>
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                {leader.playerImageUrl ? (
                  <img src={leader.playerImageUrl} alt={leader.playerName} className="h-9 w-9 rounded-full bg-[var(--ui-surface-muted)] object-cover object-top" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[11px] font-black text-[var(--ui-muted)]">{leader.playerName.slice(0, 2)}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black text-[var(--ui-ink)]">
                    {leader.playerSlug ? <Link href={`/players/${leader.playerSlug}`} className="hover:underline">{leader.playerName}</Link> : leader.playerName}
                  </p>
                  <p className="truncate text-[11px] font-bold text-[var(--ui-muted)]">
                    {leader.team?.shortName ?? ""} · {POSITION_LABELS[leader.position] ?? leader.position}
                    {leader.championNames.length > 0 ? ` · ${leader.championNames.slice(0, 2).join(", ")}` : ""}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 다음 주 프리뷰 */}
      <section className="mt-14">
        <SectionHead eyebrow="Next Week + AI Pick" title="다음 주 프리뷰" icon={Sparkles} />
        <p className="max-w-[760px] text-[16px] font-medium leading-[1.85] text-[var(--ui-text)]">{preview.intro}</p>
        {preview.matches.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {preview.matches.map((match) => {
              const picked = match.pickTeamSlug === match.teamA?.slug ? match.teamA : match.teamB;
              const teamAShare = match.pickTeamSlug === match.teamA?.slug ? match.confidence : 100 - match.confidence;
              return (
                <article key={match.matchId} className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6">
                  <p className="text-xs font-bold text-[var(--ui-muted)]">
                    {formatMatchDay(match.date)}{match.tournament ? ` · ${match.tournament}` : ""}{match.bestOf ? ` · BO${match.bestOf}` : ""}
                  </p>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                      <TeamLogo team={match.teamA} size="h-12 w-12" />
                      <b className="max-w-full truncate text-sm text-[var(--ui-ink)]">{match.teamA?.shortName ?? "TBD"}</b>
                    </div>
                    <span className="font-archivo text-sm font-black text-[var(--ui-muted)]">VS</span>
                    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                      <TeamLogo team={match.teamB} size="h-12 w-12" />
                      <b className="max-w-full truncate text-sm text-[var(--ui-ink)]">{match.teamB?.shortName ?? "TBD"}</b>
                    </div>
                  </div>
                  {picked && (
                    <div className="mt-5 rounded-xl bg-[var(--ui-surface-muted)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 font-archivo text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">
                          <Sparkles size={13} />AI Pick
                        </span>
                        <span className="text-sm font-black text-[var(--ui-ink)]">{picked.shortName} 승리 <span className="font-archivo">{match.confidence}%</span></span>
                      </div>
                      {/* 메인 승부예측 카드와 같은 방식: 좌측은 팀A, 우측은 팀B 색으로 채운다. */}
                      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full">
                        <span style={{ width: `${teamAShare}%`, background: match.teamA?.color ?? "#73767c" }} />
                        <span className="flex-1" style={{ background: match.teamB?.color ?? "#73767c" }} />
                      </div>
                      <p className="mt-3 text-[14px] font-medium leading-[1.7] text-[var(--ui-text)]">{match.reasoning}</p>
                      <p className="mt-2.5 flex items-start gap-1.5 text-[13px] font-bold text-[var(--ui-muted)]">
                        <Flame size={13} className="mt-0.5 shrink-0" />관전 포인트 — {match.keyPoint}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-[var(--ui-surface-muted)] px-5 py-6 text-sm font-bold text-[var(--ui-muted)]">다음 주 일정은 아직 확정되지 않았다. 대진이 잡히면 AI 픽과 함께 이 자리에 추가된다.</p>
        )}
        <p className="mt-5 text-[12px] font-semibold text-[var(--ui-muted)]">* AI 분석실의 예측은 경기 데이터 기반의 참고용 콘텐츠다. 결과는 무대 위 선수들이 만든다.</p>
      </section>

      <footer className="mt-16 border-t border-[var(--ui-border)] pt-5 text-[12px] font-semibold text-[var(--ui-muted)]">
        MINION AI 분석실 · {generatedAt} 발행{report.model ? ` · ${report.model}` : ""} · 모든 통계는 LCK 경기 기록 집계 기준.
      </footer>
    </div>
  );
}
