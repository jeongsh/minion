"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { ChartCard } from "@/components/charts/chart-card";
import { LineChart } from "@/components/charts/line-chart";
import { Button, buttonClassName } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EventFilterBar } from "@/components/ui/event-filter-bar";
import { EventFilterField } from "@/components/ui/event-filter-field";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading } from "@/components/ui/section-heading";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SegmentedToggle } from "@/components/ui/tabs";
import { TeamLogo } from "@/components/ui/team-logo";
import { buildPredictionReport, filterPredictionRecords, predictionProfit, type PredictionRecord, type PredictionReport, type ReportPeriod, type ReportTeam } from "@/lib/prediction-report";

const number = (value: number) => value.toLocaleString("ko-KR");
const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const profitTone = (value: number) => value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-red-500 dark:text-red-400" : "text-[var(--ui-ink)]";
const statusLabels = { open: "정산 대기", won: "적중", lost: "미적중", refunded: "환급" };
const dateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const historyDateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit" });
const shortDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
const periodOptions = [{ key: "all", label: "전체" }, { key: "30", label: "최근 30일" }, { key: "90", label: "최근 90일" }] as const;
const statusOptions = [{ value: "all", label: "모든 결과" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))];

export function PredictionReportView({ records, teams, now }: { records: PredictionRecord[]; teams: ReportTeam[]; now: number }) {
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [tournamentId, setTournamentId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const tournaments = useMemo(() => [{ value: "all", label: "모든 대회" }, ...[...new Map(records.map((record) => [record.tournamentId, record.tournamentName])).entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([value, label]) => ({ value, label }))], [records]);
  const filtered = useMemo(() => filterPredictionRecords(records, period, tournamentId, now), [records, period, tournamentId, now]);
  const report = useMemo(() => buildPredictionReport(filtered), [filtered]);
  const history = useMemo(() => filtered.filter((record) => status === "all" || record.status === status).sort((a, b) => Date.parse(b.matchDate) - Date.parse(a.matchDate) || b.id.localeCompare(a.id)), [filtered, status]);
  const totalPages = Math.max(1, Math.ceil(history.length / 12));
  const currentPage = Math.min(page, totalPages);

  const columns: DataTableColumn<PredictionRecord>[] = [
    { key: "date", label: "경기일", cellClassName: "whitespace-nowrap tabular-nums", render: (record) => <time dateTime={record.matchDate} title={dateFormat.format(new Date(record.matchDate))}>{historyDateFormat.format(new Date(record.matchDate)).replace(/\s/g, "").replace(/\.$/, "")}</time> },
    { key: "match", label: "경기", render: (record) => (
      <Link href={`/matches/${record.matchId}`} title={record.tournamentName} className="flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-sm font-medium text-[var(--ui-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          <TeamLogo team={teamMap.get(record.teamAId)} size="h-5 w-5" plain themeAware />
          {teamMap.get(record.teamAId)?.shortName ?? "미정"}
          <span className="font-normal tabular-nums text-[var(--ui-muted)]">{record.teamAScore === null || record.teamBScore === null ? "VS" : `${record.teamAScore} : ${record.teamBScore}`}</span>
          <TeamLogo team={teamMap.get(record.teamBId)} size="h-5 w-5" plain themeAware />
          {teamMap.get(record.teamBId)?.shortName ?? "미정"}
      </Link>
    ) },
    { key: "pick", label: "내 예측", align: "center", render: (record) => <span className="whitespace-nowrap">{teamMap.get(record.teamId)?.shortName ?? "미정"} 승리</span> },
    { key: "status", label: "결과", align: "center", render: (record) => <span className={`whitespace-nowrap font-medium ${record.status === "won" ? profitTone(1) : record.status === "lost" ? profitTone(-1) : "text-[var(--ui-muted)]"}`}>{statusLabels[record.status]}</span> },
    { key: "stake", label: "참여 LP", align: "center", render: (record) => <span className="whitespace-nowrap tabular-nums">{number(record.stake)}</span> },
    { key: "payout", label: "정산 LP", align: "center", render: (record) => <span className="whitespace-nowrap tabular-nums">{record.status === "open" ? "—" : number(record.payout)}</span> },
    { key: "profit", label: "순손익 LP", align: "center", render: (record) => <span className={`whitespace-nowrap font-medium tabular-nums ${profitTone(predictionProfit(record))}`}>{record.status === "open" ? "—" : signed(predictionProfit(record))}</span> },
  ];

  if (!records.length) return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="text-base text-[var(--ui-muted)]">아직 참여한 승부예측이 없어요.</p>
      <Link href="/predictions" className={buttonClassName()}>승부예측 참여하기<ArrowRight size={16} className="ml-2" aria-hidden="true" /></Link>
    </div>
  );

  return (
    <div className="mt-4 space-y-5">
      <EventFilterBar>
          <SegmentedToggle items={periodOptions} activeKey={period} ariaLabel="리포트 기간" onSelect={(value) => { setPeriod(value); setPage(1); }} />
          <EventFilterField options={tournaments} selected={tournamentId} label="대회" onSelect={(value) => { setTournamentId(value); setPage(1); }} />
      </EventFilterBar>

      {!filtered.length ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-base text-[var(--ui-muted)]">선택한 기간과 대회에 예측 기록이 없어요.</p>
          <Button variant="secondary" onClick={() => { setPeriod("all"); setTournamentId("all"); setPage(1); }}>전체 기록 보기</Button>
        </div>
      ) : <>
        <section aria-label="예측 성과 요약">
          <Table>
            <TableHeader><TableRow>
              {["참여", "적중률", "순손익 LP", "수익률"].map((label) => <TableHead key={label} scope="col" className="text-center">{label}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody><TableRow>
              <TableCell className="whitespace-nowrap text-center">{number(report.count)}</TableCell>
              <TableCell className="whitespace-nowrap text-center" title={`${report.wins}적중 ${report.losses}미적중`}>{percent(report.accuracy)}</TableCell>
              <TableCell className={`whitespace-nowrap text-center ${profitTone(report.profit)}`}>{signed(report.profit)}</TableCell>
              <TableCell className="whitespace-nowrap text-center">{report.roi === null ? "—" : `${report.roi > 0 ? "+" : ""}${report.roi.toFixed(1)}%`}</TableCell>
            </TableRow></TableBody>
          </Table>
        </section>

        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <PerformanceChart key={`${period}-${tournamentId}`} report={report} />
          <ChartCard title="팀별 적중률" reveal={false}>
            <div className="flex h-[280px] min-w-0 flex-col justify-center">
              {report.teams.length ? <ul className="max-h-[280px] space-y-3 overflow-y-auto" aria-label="선택한 팀별 적중률">{report.teams.map((item) => {
                const team = teamMap.get(item.teamId);
                return <li key={item.teamId} className="grid min-h-8 grid-cols-[76px_minmax(32px,1fr)_auto_52px] items-center gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--ui-ink)]"><TeamLogo team={team} size="h-5 w-5" plain themeAware /><span className="truncate">{team?.shortName ?? "미정"}</span></span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-[var(--ui-card-bg)]"><span className="block h-full rounded-full bg-[var(--palette-green-butter-main)]" style={{ width: `${item.wins / item.count * 100}%` }} /></span>
                  <span className="text-[13px] tabular-nums text-[var(--ui-muted)]" aria-label={`${item.count}건 중 ${item.wins}건 적중`}>{item.wins}/{item.count}</span>
                  <span className="text-right font-medium tabular-nums text-[var(--ui-ink)]">{percent(item.wins / item.count * 100)}</span>
                </li>;
              })}</ul> : <ChartEmpty />}
            </div>
          </ChartCard>
        </div>

        {report.recent.length ? <section className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-2" aria-label="최근 예측 결과">
          <div className="min-w-0">
            <p className="mb-1.5 text-sm font-medium text-[var(--ui-ink)]">최근 {report.recent.length}경기 <span className="ml-2 text-[var(--ui-muted)]">{percent(report.recentAccuracy)}</span></p>
            <ol className="flex max-w-full gap-1 overflow-x-auto">{report.recent.map((record) => <li key={record.id} className="shrink-0"><Link href={`/matches/${record.matchId}`} aria-label={`${shortDate.format(new Date(record.matchDate))} ${teamMap.get(record.teamId)?.shortName ?? "미정"} 승리 예측 ${statusLabels[record.status]}`} title={`${shortDate.format(new Date(record.matchDate))} ${statusLabels[record.status]}`} className={`grid h-9 w-9 place-items-center rounded-md text-sm font-medium transition hover:opacity-70 focus-visible:outline-2 focus-visible:outline-accent ${record.status === "won" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{record.status === "won" ? "W" : "L"}</Link></li>)}</ol>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ui-muted)]">
            <span>현재 <span className="ml-1 font-medium text-[var(--ui-ink)]">{Math.abs(report.streak)}연속 {report.streak > 0 ? "적중" : "미적중"}</span></span>
            <span>최장 <span className="ml-1 font-medium text-[var(--ui-ink)]">{report.bestStreak}연속 적중</span></span>
          </div>
        </section> : null}

        <section className="min-w-0" aria-labelledby="prediction-history-heading">
          <SectionHeading aside={<div className="flex items-center gap-2"><span className="text-[13px] text-[var(--ui-muted)]" aria-live="polite">{number(history.length)}건</span><EventFilterField options={statusOptions} selected={status} label="예측 결과" onSelect={(value) => { setStatus(value); setPage(1); }} /></div>}><span id="prediction-history-heading">예측 이력</span></SectionHeading>
          {history.length ? <DataTable compact columns={columns} rows={history.slice((currentPage - 1) * 12, currentPage * 12)} /> : <p className="py-8 text-center text-base text-[var(--ui-muted)]">선택한 결과에 해당하는 예측이 없어요.</p>}
          {totalPages > 1 ? <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} className="mt-2" /> : null}
        </section>
      </>}
    </div>
  );
}

function ChartEmpty() {
  return <div className="grid min-h-[280px] place-items-center px-3 text-center"><p className="text-base text-[var(--ui-muted)]">정산 기록이 없어요.</p></div>;
}

function PerformanceChart({ report }: { report: PredictionReport }) {
  const [mode, setMode] = useState<"profit" | "accuracy">("profit");
  const values = report.trend.map((point) => point[mode]);
  const rawMin = mode === "accuracy" ? 0 : Math.min(0, ...values);
  const rawMax = mode === "accuracy" ? 100 : Math.max(0, ...values);
  const padding = mode === "accuracy" ? 0 : Math.max(1, (rawMax - rawMin) * 0.12);
  const min = rawMin - padding, max = rawMax + padding;
  const magnitude = 10 ** Math.floor(Math.log10((max - min) / 4));
  const step = Math.max(1, ([1, 2, 2.5, 5, 10].find((value) => value * magnitude >= (max - min) / 4) ?? 10) * magnitude);
  const firstTick = Math.ceil(min / step) * step;
  const ticks = mode === "accuracy" ? [0, 25, 50, 75, 100] : Array.from({ length: Math.floor((max - firstTick) / step) + 1 }, (_, index) => firstTick + index * step);

  return <ChartCard title="성과 추이" reveal={false} legend={<SegmentedToggle items={[{ key: "profit", label: "LP 손익" }, { key: "accuracy", label: "적중률" }]} activeKey={mode} ariaLabel="성과 그래프 지표" onSelect={setMode} />}>
    <LineChart key={mode} interactive leftPadding={mode === "profit" ? 64 : 42}
      label={(mode === "profit" ? "기간 내 누적 순손익" : "기간 내 누적 적중률") + " 그래프. 좌우 방향키로 경기별 수치를 확인하세요."}
      yDomain={[min, max]} yTicks={ticks} formatX={(value) => shortDate.format(new Date(value))}
      formatY={(value) => mode === "accuracy" ? value + "%" : Math.abs(value) >= 100_000 ? value.toLocaleString("ko-KR", { notation: "compact", maximumFractionDigits: 1 }) : number(value)}
      emptyText="정산 기록이 없어요."
      series={[{ label: mode === "profit" ? "LP 순손익" : "누적 적중률", color: "var(--palette-green-butter-main)", points: report.trend.map((point) => ({
        x: Date.parse(point.date), y: point[mode],
        label: shortDate.format(new Date(point.date)) + "까지 " + point.count + "경기 " + (mode === "profit" ? signed(point.profit) + " LP" : percent(point.accuracy) + " (" + point.wins + "/" + point.count + ")"),
      })) }]} />
  </ChartCard>;
}
