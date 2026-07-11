import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatCard } from "@/components/ui/stat-card";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { TeamLogo } from "@/components/ui/team-logo";
import type { PlayerRecord, TeamRecord } from "@/lib/records";
import type { PlayerPosition, Tournament } from "@/lib/types";

type RecordsTab = "overview" | "players" | "teams";
type RankedPlayer = PlayerRecord & { rank: number };
type RankedTeam = TeamRecord & { rank: number };
const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const percent = (value: number) => `${number.format(value)}%`;
const signed = (value: number | null) => value == null ? "-" : `${value > 0 ? "+" : ""}${number.format(value)}`;

const playerColumns: DataTableColumn<RankedPlayer>[] = [
  { key: "rank", label: "순위", render: (row) => <span className="text-sm font-black tabular-nums">{row.rank}</span>, cellClassName: "w-16" },
  { key: "player", label: "선수", render: (row) => <div className="relative z-20 flex items-center gap-3"><TeamLogo team={row.team} size="h-8 w-8" themeAware /><div><p className="font-bold text-[var(--ui-ink)]">{row.player.name}</p><p className="text-xs font-semibold text-[var(--ui-muted)]">{row.team?.shortName ?? "-"} · {row.player.position}</p></div></div> },
  { key: "games", label: "세트", render: (row) => row.games, headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "winRate", label: "승률", render: (row) => percent((row.wins / row.games) * 100), headerClassName: "text-right", cellClassName: "text-right tabular-nums font-semibold" },
  { key: "kda", label: "KDA", render: (row) => number.format(row.kda), headerClassName: "text-right", cellClassName: "text-right tabular-nums font-black text-[var(--ui-ink)]" },
  { key: "kp", label: "킬 관여", render: (row) => percent(row.killParticipation), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "dpm", label: "DPM", render: (row) => number.format(row.dpm), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "csm", label: "CS/M", render: (row) => number.format(row.csPerMinute), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "gd15", label: "15분 GD", render: (row) => signed(row.goldDiffAt15), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
];

const teamColumns: DataTableColumn<RankedTeam>[] = [
  { key: "rank", label: "순위", render: (row) => <span className="text-sm font-black tabular-nums">{row.rank}</span>, cellClassName: "w-16" },
  { key: "team", label: "팀", render: (row) => <div className="relative z-20 flex items-center gap-3"><TeamLogo team={row.team} size="h-9 w-9" themeAware /><div><p className="font-bold text-[var(--ui-ink)]">{row.team.name}</p><p className="text-xs font-semibold text-[var(--ui-muted)]">{row.team.shortName}</p></div></div> },
  { key: "matches", label: "매치", render: (row) => `${row.matchWins}-${row.matches - row.matchWins}`, headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "games", label: "세트", render: (row) => row.games, headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "winRate", label: "세트 승률", render: (row) => percent((row.wins / row.games) * 100), headerClassName: "text-right", cellClassName: "text-right tabular-nums font-black text-[var(--ui-ink)]" },
  { key: "kills", label: "평균 킬", render: (row) => number.format(row.kills / row.games), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "kda", label: "K/D", render: (row) => number.format(row.kda), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "duration", label: "평균 시간", render: (row) => `${Math.floor(row.averageDuration)}:${String(Math.round((row.averageDuration % 1) * 60)).padStart(2, "0")}`, headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
  { key: "dpm", label: "팀 DPM", render: (row) => number.format(row.dpm), headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
];

function FilterBar({ tournaments, season, tournamentId, position, tab }: { tournaments: Tournament[]; season: number; tournamentId: string; position: string; tab: RecordsTab }) {
  const seasons = [...new Set(tournaments.map((item) => item.season))].sort((a, b) => b - a);
  const seasonTournaments = tournaments.filter((item) => item.season === season);
  const selectClass = "h-10 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-ink)]";
  return <form className="flex flex-wrap items-end gap-3" method="get">
    <input type="hidden" name="tab" value={tab} />
    <label className="grid gap-1.5 text-xs font-bold text-[var(--ui-muted)]">시즌<select name="season" defaultValue={season} className={selectClass}>{seasons.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="grid min-w-48 gap-1.5 text-xs font-bold text-[var(--ui-muted)]">대회<select name="tournament" defaultValue={tournamentId} className={selectClass}><option value="all">전체 대회</option>{seasonTournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {tab !== "teams" ? <label className="grid gap-1.5 text-xs font-bold text-[var(--ui-muted)]">포지션<select name="position" defaultValue={position} className={selectClass}><option value="all">전체</option>{(["TOP", "JGL", "MID", "BOT", "SUP"] satisfies PlayerPosition[]).map((value) => <option key={value}>{value}</option>)}</select></label> : null}
    <button className="h-10 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-4 text-sm font-bold text-[var(--ui-surface)] transition active:translate-y-px" type="submit">적용</button>
  </form>;
}

export function RecordsView({ tab, tournaments, season, tournamentId, position, playerRecords, teamRecords, matchCount, setCount, averageDuration }: { tab: RecordsTab; tournaments: Tournament[]; season: number; tournamentId: string; position: string; playerRecords: PlayerRecord[]; teamRecords: TeamRecord[]; matchCount: number; setCount: number; averageDuration: number }) {
  const rankedPlayers = playerRecords.map((row, index) => ({ ...row, rank: index + 1 }));
  const rankedTeams = teamRecords.map((row, index) => ({ ...row, rank: index + 1 }));
  const query = `season=${season}&tournament=${tournamentId}&position=${position}`;
  const tabs: { key: RecordsTab; label: string }[] = [{ key: "overview", label: "종합" }, { key: "players", label: "선수" }, { key: "teams", label: "팀" }];
  return <>
    <nav className="flex gap-7 overflow-x-auto border-b border-[var(--ui-border)] px-2" aria-label="기록실 분류">{tabs.map((item) => <Link key={item.key} href={`/records?tab=${item.key}&${query}`} className={`font-paperozi shrink-0 border-b-[3px] px-2 py-3 text-base transition-colors ${tab === item.key ? "border-[var(--ui-ink)] text-[var(--ui-ink)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>{item.label}</Link>)}</nav>
    <SurfacePanel className="p-4 sm:p-5"><FilterBar tournaments={tournaments} season={season} tournamentId={tournamentId} position={position} tab={tab} /></SurfacePanel>
    {tab === "overview" ? <div className="space-y-10">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="완료 매치" value={number.format(matchCount)} helper={`${season} 시즌 집계`} /><StatCard label="집계 세트" value={number.format(setCount)} helper="완료 및 동기화 세트" /><StatCard label="기록 선수" value={number.format(playerRecords.length)} helper={position === "all" ? "전체 포지션" : position} /><StatCard label="평균 경기 시간" value={`${Math.floor(averageDuration)}분`} helper="완료 세트 기준" /></div>
      <section><SectionHeading aside={<Link href={`/records?tab=players&${query}`} className="text-sm font-bold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">전체 선수 기록</Link>}>선수 기록 TOP 5</SectionHeading><DataTable variant="hub" columns={playerColumns} rows={rankedPlayers.slice(0, 5)} getRowHref={(row) => `/players/${row.player.slug}`} emptyText="선수 기록이 아직 없습니다." /></section>
      <section><SectionHeading aside={<Link href={`/records?tab=teams&${query}`} className="text-sm font-bold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">전체 팀 기록</Link>}>팀 기록 TOP 5</SectionHeading><DataTable variant="hub" columns={teamColumns} rows={rankedTeams.slice(0, 5)} getRowHref={(row) => `/teams/${row.team.slug}`} emptyText="팀 기록이 아직 없습니다." /></section>
    </div> : tab === "players" ? <section><SectionHeading caption={`${rankedPlayers.length} PLAYERS`}>선수 기록</SectionHeading><DataTable variant="hub" columns={playerColumns} rows={rankedPlayers} getRowHref={(row) => `/players/${row.player.slug}`} emptyText="선택한 조건에 집계 가능한 선수 기록이 없습니다." /></section> : <section><SectionHeading caption={`${rankedTeams.length} TEAMS`}>팀 기록</SectionHeading><DataTable variant="hub" columns={teamColumns} rows={rankedTeams} getRowHref={(row) => `/teams/${row.team.slug}`} emptyText="선택한 조건에 집계 가능한 팀 기록이 없습니다." /></section>}
    <p className="border-t border-[var(--ui-border)] pt-4 text-xs leading-5 text-[var(--ui-muted)]">완료된 세트의 경기·선수 데이터만 집계합니다. KDA는 (킬 + 어시스트) / 데스, DPM과 CS/M은 실제 경기 시간 기준이며 누락된 세트는 순위에서 자동 제외됩니다.</p>
  </>;
}
