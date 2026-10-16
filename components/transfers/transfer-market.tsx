"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronsRight, Search, UserRound } from "lucide-react";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { TeamLogo } from "@/components/ui/team-logo";
import { AdSlot } from "@/components/ui/ad-slot";
import { A11y } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { useSwiperResize } from "@/components/ui/use-swiper-resize";
import "swiper/css";
import { SegmentedToggle } from "@/components/ui/tabs";
import type { Player, Team } from "@/lib/types";
import { departuresForTeam, resolveTransferRosters } from "@/lib/transfers/view";
import { latestPlayerEvents, lckTeamCode, marketEvents, movementCategory, normalizeTransferName, TRANSFER_KIND_LABELS, TRANSFER_ROLES, type TransferEvent, type TransferMarket, type TransferPerson, type TransferRole } from "@/lib/transfers/types";

const ROLE_ICONS: Record<string, string> = { TOP: "top", JGL: "jungle", MID: "middle", BOT: "bottom", SUP: "utility" };
const ROLE_LABELS: Record<TransferRole, string> = { TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서포터", COACH: "감독" };
const MOVEMENT_OPTIONS = [ { value: "all", label: "전체 변동" }, { value: "domestic", label: "LCK 내 이동" }, { value: "outgoing", label: "LCK 이탈" }, { value: "incoming", label: "LCK 합류" }, { value: "renew", label: "재계약" }, { value: "leave", label: "계약 종료" }, { value: "retire", label: "은퇴" }, { value: "inactive", label: "휴식 / 군 복무" } ];
const VIEW_OPTIONS = [{ key: "rosters", label: "팀별 로스터" }, { key: "moves", label: "선수 이동" }, { key: "fa", label: "FA" }];
const filterTrigger = "h-8 w-full justify-between whitespace-nowrap rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-[var(--ui-text)] outline-none focus-visible:border-[var(--ui-ink)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)]";

function RoleIcon({ role }: { role: TransferRole }) {
  return <span className="flex w-5 shrink-0 items-center justify-center" title={ROLE_LABELS[role]}>{role === "COACH" ? <UserRound size={18} className="text-[var(--ui-muted)]" aria-label="감독" /> : <span role="img" aria-label={ROLE_LABELS[role]} className="block size-5 bg-[var(--ui-muted)]" style={{ maskImage: `url(/objectives/position-${ROLE_ICONS[role]}.svg)`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }} />}</span>;
}

function destination(event: TransferEvent) {
  return event.to || (event.kind === "retire" ? "은퇴" : event.kind === "inactive" ? "휴식 / 군 복무" : "행선지 미정");
}

export function TransferMarketView({ market, teams, players, followedTeamIds = [] }: { market: TransferMarket; teams: Team[]; players: Player[]; followedTeamIds?: string[] }) {
  const setSwiper = useSwiperResize();
  const [tab, setTab] = useState("rosters");
  const [teamFilter, setTeamFilter] = useState("all");
  const [movement, setMovement] = useState("all");
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState(true);
  const allEvents = useMemo(() => marketEvents(market), [market]);
  const events = allEvents.filter((e) => reports || e.provenance !== "report");
  const rosters = useMemo(() => resolveTransferRosters(market.snapshot.rosters, allEvents, market.season), [market, allEvents]);
  const playerByName = useMemo(() => new Map(players.map((p) => [normalizeTransferName(p.name), p])), [players]);
  const teamByCode = new Map(teams.flatMap((t) => { const code = lckTeamCode(t.shortName); return code ? [[code, t] as const] : []; }));
  const teamByName = new Map(teams.flatMap((t) => [t.name, t.shortName, t.slug].map((name) => [normalizeTransferName(name), t] as const)));
  const isFollowed = (code: string) => { const team = teamByCode.get(code); return team && (followedTeamIds.includes(team.id) || followedTeamIds.includes(team.fanSiteHost)); };
  const ordered = [...rosters].sort((a, b) => Number(Boolean(isFollowed(b.team))) - Number(Boolean(isFollowed(a.team))));
  const latest = latestPlayerEvents(events.filter((e) => e.provenance !== "report"));
  const freeAgents = latest.filter((e) => e.kind === "leave" && !e.to);
  const keyword = normalizeTransferName(query);
  const matchesTeam = (e: TransferEvent) => teamFilter === "all" || lckTeamCode(e.from) === teamFilter || lckTeamCode(e.to) === teamFilter || market.snapshot.rosters.find((r) => r.team === teamFilter)?.slots.some((s) => s.previous.some((p) => normalizeTransferName(p.name) === normalizeTransferName(e.player)));
  const matching = (e: TransferEvent) => matchesTeam(e) && (role === "all" || role === e.role) && (!keyword || normalizeTransferName(`${e.player} ${e.realName}`).includes(keyword));
  const recentEvents = allEvents.filter((e) => e.provenance !== "report" && matchesTeam(e));
  const visibleEvents = (tab === "fa" ? freeAgents : events).filter((e) => matching(e) && (tab === "fa" || movement === "all" || movementCategory(e) === movement || (movement === "outgoing" && movementCategory(e) === "tracked")));
  const hasAdContent = recentEvents.length > 0 || (tab === "rosters"
    ? ordered.some((roster) => (teamFilter === "all" || teamFilter === roster.team) && roster.slots.some((slot) => slot.previous.length > 0 || slot.next.length > 0))
    : visibleEvents.length > 0);

  function playerName(person: TransferPerson | { name: string }, muted = false) {
    const player = playerByName.get(normalizeTransferName(person.name));
    const className = `inline-block max-w-full truncate align-middle text-[15px] leading-5 ${muted ? "font-medium text-[var(--ui-muted)]" : "font-bold text-[var(--ui-ink)]"}`;
    return player ? <Link href={`/players/${player.slug}`} title={person.name} className={`${className} hover:underline`}>{person.name}</Link> : <span title={person.name} className={className}>{person.name}</span>;
  }
  function teamName(name: string, compact = false, adaptive: "movement" | "history" | false = false) {
    const code = lckTeamCode(name);
    const team = (code ? teamByCode.get(code) : undefined) ?? teamByName.get(normalizeTransferName(name));
    const labelVisibility = adaptive === "movement" ? "hidden @[220px]/movement:inline" : "hidden @[480px]/history:inline";
    if (compact) return <span title={code === "DNS" ? "DN SOOPers" : team?.name ?? name} className={`inline-flex min-w-0 max-w-20 items-center gap-1 text-[13px] font-normal text-[var(--ui-muted)] ${adaptive ? "" : "shrink-0"}`}>{team?.logoUrl && <TeamLogo team={team} size="size-5" plain themeAware />}<span className={`truncate ${adaptive && team?.logoUrl ? labelVisibility : ""}`}>{team?.shortName ?? name}</span></span>;
    return <span className="inline-flex min-w-0 items-center gap-1.5">{team && <TeamLogo team={team} size="size-5" plain themeAware />}<span className="break-words">{team?.shortName ?? name}</span></span>;
  }
  function movementSummary(label: string, moves: TransferEvent[], incoming: boolean, team: string) {
    return <section className="@container/movement min-w-0 bg-[var(--ui-surface)] dark:bg-[var(--ui-card-bg)]" aria-label={`${team} ${label}`}>
      <h3 className={`flex h-12 items-center gap-2 border-b border-[var(--ui-card-divider)] bg-[var(--ui-card-bg)] px-3 text-[16px] font-bold ${incoming ? "text-[var(--accent)]" : "text-[var(--ui-ink)]"}`}>{label}<span className="text-[13px] font-normal text-[var(--ui-muted)]">{moves.length}</span></h3>
      <div className="divide-y divide-[var(--ui-card-divider)] dark:divide-transparent" aria-label={`${team} ${label} 선수 목록`}>
        {moves.length ? moves.map((event) => <div key={event.id} className="grid min-h-14 min-w-0 grid-cols-[20px_minmax(0,1fr)] items-center gap-x-2 px-2 py-1.5 @[220px]/movement:px-3 dark:odd:bg-[var(--ui-card-hover)]" aria-label={`${event.player} ${event.from || "이전 팀 미정"}에서 ${destination(event)}`}>
          <RoleIcon role={event.role} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {playerName({ name: event.player })}
            <div className="flex min-w-0 max-w-full items-center gap-2" title={`${event.from || "이전 팀 미정"} → ${destination(event)}`}>
              {teamName(event.from || "미정", true, "movement")}
              <ChevronsRight size={18} strokeWidth={1.75} className="shrink-0 text-[var(--ui-muted)]" aria-hidden />
              {teamName(destination(event), true, "movement")}
            </div>
          </div>
        </div>) : <span className="flex h-14 items-center px-3 text-[13px] font-normal text-[var(--ui-muted)]" aria-label={`${label} 없음`}>—</span>}
      </div>
    </section>;
  }

  return <div className="min-w-0">
    <section className="relative mb-4 min-w-0" aria-label="최근 변동">
      {recentEvents.length ? <>
        <Swiper key={teamFilter} modules={[A11y]} onSwiper={setSwiper} slidesPerView="auto" spaceBetween={8} watchOverflow grabCursor>
          {recentEvents.map((event) => <SwiperSlide key={event.id} style={{ width: "auto", maxWidth: "100%", height: "auto" }}>
            <article className="flex min-h-11 w-max max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2">
              <span className="shrink-0 rounded bg-[var(--ui-surface)] px-1.5 py-0.5 text-[13px] font-medium text-[var(--accent)]">{TRANSFER_KIND_LABELS[event.kind]}</span>
              {playerName({ name: event.player })}
              <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-normal text-[var(--ui-muted)]">{teamName(event.from || "미정", true)}{event.kind !== "renew" && <><ChevronsRight size={18} strokeWidth={1.75} className="mx-2 shrink-0" aria-hidden />{teamName(destination(event), true)}</>}</div>
            </article>
          </SwiperSlide>)}
        </Swiper>
      </> : <p className="text-base font-normal text-[var(--ui-muted)]">확인된 변동이 없습니다.</p>}
    </section>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SegmentedToggle items={VIEW_OPTIONS} activeKey={tab} onSelect={setTab} ariaLabel="이적시장 보기" controlsId="transfer-market-content" />
        <FilterDropdown ariaLabel="팀 선택" selected={teamFilter} onSelect={setTeamFilter} options={[{ value: "all", label: "전체 팀" }, ...ordered.map((roster) => ({ value: roster.team, label: roster.team === "DNS" ? "DN SOOPers" : teamByCode.get(roster.team)?.shortName ?? roster.team }))]} controlSize="compact" rootClassName="min-w-[104px] sm:min-w-[140px]" triggerClassName={filterTrigger} triggerTypography="ui" />
        {tab !== "rosters" && <>
        {tab === "moves" && <FilterDropdown ariaLabel="변동 종류" selected={movement} onSelect={setMovement} options={MOVEMENT_OPTIONS} controlSize="compact" rootClassName="min-w-[128px]" triggerClassName={filterTrigger} triggerTypography="ui" />}
        <FilterDropdown ariaLabel="포지션" selected={role} onSelect={setRole} options={[{ value: "all", label: "전체 포지션" }, ...[...TRANSFER_ROLES, "COACH" as const].map((r) => ({ value: r, label: ROLE_LABELS[r] }))]} controlSize="compact" rootClassName="min-w-[128px]" triggerClassName={filterTrigger} triggerTypography="ui" />
        {tab === "moves" && <label className="flex h-8 items-center gap-1.5 text-[13px] font-medium text-[var(--ui-text)]"><input type="checkbox" checked={reports} onChange={(e) => setReports(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />보도 포함</label>}
        <label className="relative min-w-0 basis-full sm:ml-auto sm:w-60 sm:basis-auto"><span className="sr-only">선수 검색</span><Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]" /><input type="search" aria-label="선수 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="선수 검색" className="h-8 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] pl-9 pr-3 text-[13px] font-medium outline-none transition placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-ink)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)]" /></label>
        </>}
    </div>
    {tab === "rosters" ? <div id="transfer-market-content" className="space-y-5" aria-label="팀별 로스터">
      {ordered.filter((r) => teamFilter === "all" || teamFilter === r.team).map((roster) => {
        const team = teamByCode.get(roster.team);
        const departures = departuresForTeam(roster.team, market.snapshot.rosters, allEvents);
        const arrivals = latest.filter((event) => lckTeamCode(event.to) === roster.team && ["transfer", "loan", "promote"].includes(event.kind) && (event.kind === "promote" || lckTeamCode(event.from) !== roster.team) && roster.slots.some((slot) => slot.next.some((person) => normalizeTransferName(person.name) === normalizeTransferName(event.player))));
        const arrivalNames = new Set(arrivals.map((event) => normalizeTransferName(event.player)));
        return <article key={roster.team} className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-md bg-[var(--ui-border)] p-px md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <section className="col-span-2 min-w-0 bg-[var(--ui-surface)] dark:bg-[var(--ui-card-bg)] md:col-span-1" aria-label={`${roster.team} 포지션별 로스터`}>
          <header className="relative flex h-12 items-center gap-2.5 border-b border-[var(--ui-card-divider)] bg-[var(--ui-card-bg)] px-3">
            <TeamLogo team={team} size="size-7" plain themeAware />
            <h2 className="max-w-40 break-keep text-[16px] font-bold leading-5">{roster.team === "DNS" ? "DN SOOPers" : team?.name ?? roster.team}</h2>
          </header>
          <div className="divide-y divide-[var(--ui-card-divider)] dark:divide-transparent">
            {[...roster.slots.filter((s) => s.role !== "COACH"), ...roster.slots.filter((s) => s.role === "COACH")].map((slot) => <div key={slot.role} className="grid min-h-14 grid-cols-[20px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-x-2 px-3 py-1.5 dark:odd:bg-[var(--ui-card-hover)]">
              <RoleIcon role={slot.role} />
              <div className="min-w-0" aria-label="기존 선수">{slot.previous.map((p) => <div key={p.name}>
                {playerName(p, true)}
              </div>)}</div>
              <ChevronsRight size={18} strokeWidth={1.75} className="text-[var(--ui-muted)]" aria-hidden />
              <div className="min-w-0 text-right" aria-label="새 로스터">{slot.next.length ? slot.next.map((p) => <div key={p.name}>
                <div className="flex min-w-0 items-center justify-end gap-1.5">{arrivalNames.has(normalizeTransferName(p.name)) && <span className="shrink-0 text-[13px] font-medium text-[var(--accent)]">합류</span>}{playerName(p)}</div>
              </div>) : <span aria-label="미발표" className="text-base font-medium text-[var(--ui-muted)]">—</span>}</div>
            </div>)}
          </div>
          </section>
            {movementSummary("합류", arrivals, true, roster.team)}
            {movementSummary("이탈", departures, false, roster.team)}
        </article>;
      })}
    </div> : <div id="transfer-market-content" className="@container/history" aria-live="polite">
      {visibleEvents.length ? <div className="divide-y divide-[var(--ui-card-divider)]">{visibleEvents.map((e) => <article key={e.id} className="grid min-h-14 min-w-0 grid-cols-[minmax(0,100px)_auto_minmax(64px,1fr)_auto] items-center gap-2 py-3 @[640px]/history:grid-cols-[90px_140px_auto_minmax(0,1fr)_104px] @[640px]/history:gap-3" aria-label={`${e.player} ${TRANSFER_KIND_LABELS[e.kind]} ${e.from || "이전 팀 미정"}에서 ${destination(e)}${e.date ? `, ${e.date}` : ""}`}>
        <time className="hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)] @[640px]/history:block">{e.date ?? "날짜 미상"}</time>
        <div className="flex min-w-0 items-center gap-2"><span className="hidden shrink-0 @[640px]/history:block"><RoleIcon role={e.role} /></span><span className="min-w-0">{playerName({ name: e.player })}</span></div>
        <span className="w-fit whitespace-nowrap rounded bg-[var(--ui-card-bg)] px-2 py-0.5 text-[13px] font-medium">{TRANSFER_KIND_LABELS[e.kind]}</span>
        <div className="flex min-w-0 items-center gap-1.5" title={`${e.from || "이전 팀 미정"}${e.kind !== "renew" ? ` → ${destination(e)}` : ""}`}>{teamName(e.from || "미정", true, "history")}{e.kind !== "renew" && <><ChevronsRight size={18} strokeWidth={1.75} className="shrink-0 text-[var(--ui-muted)]" aria-hidden />{teamName(destination(e), true, "history")}</>}</div>
        <span className="whitespace-nowrap text-right text-[13px] font-normal text-[var(--ui-muted)]" title={e.contractUntil ? `${e.player} 계약 종료일` : undefined}>{e.contractUntil?.replaceAll("-", ".")}</span>
      </article>)}</div> : <p className="rounded-xl bg-[var(--ui-card-bg)] px-5 py-10 text-center text-base font-normal text-[var(--ui-muted)]">{tab === "fa" ? "확인된 FA 선수가 없습니다." : "조건에 맞는 변동 소식이 없습니다."}</p>}
      {tab === "fa" && <section className="mt-8"><h2 className="home-section-title mb-3 text-xl font-normal">계약 종료 예정</h2><p className="mb-4 text-base font-normal text-[var(--ui-muted)]">실제 계약 종료가 발표되기 전까지는 FA로 분류하지 않습니다.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{market.snapshot.faCandidates.filter((p) => (teamFilter === "all" || p.team === teamFilter) && (role === "all" || role === p.role) && (!keyword || normalizeTransferName(p.player).includes(keyword)) && !latest.some((e) => normalizeTransferName(e.player) === normalizeTransferName(p.player))).map((p) => <div key={`${p.team}:${p.player}`} className="flex items-center gap-3 rounded-xl bg-[var(--ui-card-bg)] p-3"><RoleIcon role={p.role} />{playerName({ name: p.player })}<span className="ml-auto">{teamName(p.team, true)}</span></div>)}</div></section>}
    </div>}
    {tab !== "rosters" && <footer className="mt-5 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">확인 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(market.checked_at))}</footer>}
    <AdSlot enabled={hasAdContent} placement="horizontal" className="mt-6 h-[60px] xl:h-[90px]" />
  </div>;
}
