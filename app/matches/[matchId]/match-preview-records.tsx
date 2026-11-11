import type { ReactNode } from "react";
import Link from "next/link";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Match, Team } from "@/lib/types";
import {
  recordRate, type MatchPreviewRecords, type PreviewHeadToHead, type PreviewTeamRecord, type RateRecord,
} from "@/lib/match-preview-records";
import { matchHref, teamLabel } from "@/lib/view-data";
import { Bar, CARD_SURFACE, ChartCard, Legend, META } from "./match-preview-charts";

const VALUE = "shrink-0 text-[15px] font-bold tabular-nums text-[var(--ui-ink)]";

/** 왼쪽 팀 값, 가운데 항목명, 오른쪽 팀 값. 막대는 가운데에서 바깥으로 자란다. */
function CompareRow({ label, left, right, labelClassName = "w-28" }: {
  label: string; left: ReactNode; right: ReactNode; labelClassName?: string;
}) {
  return (
    <div role="listitem" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <div className="flex min-w-0 items-center justify-end gap-2">{left}</div>
      <span className={`text-center ${labelClassName} ${META}`}>{label}</span>
      <div className="flex min-w-0 items-center justify-start gap-2">{right}</div>
    </div>
  );
}

/** 표본이 모자라면 비율 대신 "승/전체" 건수만 보여준다. */
function RateSide({ record, color, side, index }: { record: RateRecord; color: string; side: "left" | "right"; index: number }) {
  const rate = recordRate(record);
  const text = rate == null
    ? <span className={`shrink-0 tabular-nums ${META}`}>{record.wins}/{record.games}</span>
    : <span className={VALUE}>{rate}%</span>;
  const track = (
    <span className={`flex min-w-0 flex-1 ${side === "left" ? "justify-end" : "justify-start"}`}>
      {rate ? <Bar percent={Math.max(4, rate)} color={color} origin={side === "left" ? "right" : "left"} index={index} /> : null}
    </span>
  );
  return side === "left" ? <>{text}{track}</> : <>{track}{text}</>;
}

function RateRow({ label, records, colors, index }: { label: string; records: RateRecord[]; colors: string[]; index: number }) {
  return (
    <CompareRow label={label}
      left={<RateSide record={records[0]} color={colors[0]} side="left" index={index} />}
      right={<RateSide record={records[1]} color={colors[1]} side="right" index={index} />} />
  );
}

function FormChips({ form, name }: { form: Array<"W" | "L">; name: string }) {
  if (!form.length) return <span className={VALUE}>-</span>;
  return (
    <span className="flex shrink-0 gap-0.5" role="img" aria-label={`${name} 최근 ${form.length}경기 ${form.map((result) => result === "W" ? "승" : "패").join(" ")}`}>
      {form.map((result, index) => (
        <span key={index} aria-hidden className={`grid h-5 w-5 place-items-center rounded text-xs font-medium ${
          result === "W" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-card-bg)] text-[var(--ui-muted)]"
        }`}>{result}</span>
      ))}
    </span>
  );
}

function minuteLabel(value: number | null) {
  if (value == null) return "-";
  const seconds = Math.round(value * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function TextRow({ label, values }: { label: string; values: string[] }) {
  return <CompareRow label={label} left={<span className={VALUE}>{values[0]}</span>} right={<span className={VALUE}>{values[1]}</span>} />;
}

function RecentFlow({ names, colors, records }: { names: string[]; colors: string[]; records: PreviewTeamRecord[] }) {
  return (
    <ChartCard title="최근 흐름" legend={<Legend names={names} colors={colors} />}>
      <div className="grid gap-3.5" role="list">
        <CompareRow label="최근 5경기" labelClassName=""
          left={<FormChips form={records[0].form} name={names[0]} />}
          right={<FormChips form={records[1].form} name={names[1]} />} />
        <RateRow label="세트 승률" records={records.map((record) => record.recentSets)} colors={colors} index={0} />
        <TextRow label="평균 경기 시간" values={records.map((record) => minuteLabel(record.averageMinutes))} />
        <TextRow label="세트당 킬 합계" values={records.map((record) => record.averageTotalKills == null ? "-" : record.averageTotalKills.toFixed(1))} />
      </div>
    </ChartCard>
  );
}

function SeriesFlow({ names, colors, records }: { names: string[]; colors: string[]; records: PreviewTeamRecord[] }) {
  const outcomes = records[0].outcomes;
  return (
    <ChartCard title="시리즈 흐름" legend={<Legend names={names} colors={colors} />}>
      <div className="grid gap-3.5" role="list">
        {outcomes.map((outcome, index) => (
          <RateRow key={outcome.label} label={`${outcome.label} ${outcome.win ? "승" : "패"}`} colors={colors} index={index}
            records={records.map((record) => ({ wins: record.outcomes[index].count, games: record.seriesMatches }))} />
        ))}
        <RateRow label="1세트 승률" records={records.map((record) => record.firstSet)} colors={colors} index={outcomes.length} />
        <RateRow label="1세트 승리 시 승률" records={records.map((record) => record.afterFirstSetWin)} colors={colors} index={outcomes.length + 1} />
      </div>
    </ChartCard>
  );
}

function Meetings({ teams, names, meetings, headToHead, formatDate }: {
  teams: Team[]; names: string[]; meetings: Match[]; headToHead: PreviewHeadToHead; formatDate: (value: string) => string;
}) {
  return (
    <section className={`rounded-xl ${CARD_SURFACE} p-4 sm:p-5`} aria-label="맞대결">
      <h3 className="text-lg font-bold leading-7 text-[var(--ui-ink)]">맞대결</h3>
      <div className="mt-3 flex items-center justify-between gap-3">
        {[0, 1].map((index) => (
          <span key={index} className={`flex min-w-0 items-baseline gap-2 ${index ? "flex-row-reverse text-right" : ""}`}>
            <strong className="truncate text-2xl font-black leading-8 tabular-nums text-[var(--ui-ink)]">
              {names[index]} {index ? headToHead.winsB : headToHead.winsA}승
            </strong>
            <span className={`shrink-0 tabular-nums ${META}`}>세트 {index ? headToHead.setWinsB : headToHead.setWinsA}승</span>
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {meetings.slice(0, 6).map((meeting) => (
          <Link key={meeting.id} href={matchHref(meeting)} className="grid grid-cols-[48px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5 hover:bg-[var(--ui-card-hover)]">
            <span className={META}>{formatDate(meeting.matchDate)}</span>
            <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[15px] font-medium text-[var(--ui-ink)]">
              <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate">{teamLabel(teams, meeting.teamAId)}</span><TeamLogo team={teams.find((team) => team.id === meeting.teamAId)} size="h-5 w-5" plain themeAware /></span>
              <strong className="text-[15px] font-black tabular-nums">{meeting.teamAScore} : {meeting.teamBScore}</strong>
              <span className="flex min-w-0 items-center gap-2"><TeamLogo team={teams.find((team) => team.id === meeting.teamBId)} size="h-5 w-5" plain themeAware /><span className="truncate">{teamLabel(teams, meeting.teamBId)}</span></span>
            </span>
            <span className="text-right text-xs font-medium text-[var(--ui-muted)]">BO{meeting.bestOf}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** AI 브리핑 안에서 승리 확률 카드 바로 아래에 놓는 전적 카드 묶음. */
export function MatchRecordCards({ teams, names, colors, records, meetings, headToHead, formatDate }: {
  teams: Team[];
  names: string[];
  colors: string[];
  records: MatchPreviewRecords;
  meetings: Match[];
  headToHead: PreviewHeadToHead;
  formatDate: (value: string) => string;
}) {
  const teamRecords = [records.teamA, records.teamB];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <RecentFlow names={names} colors={colors} records={teamRecords} />
        <SeriesFlow names={names} colors={colors} records={teamRecords} />
      </div>
      {meetings.length ? (
        <Meetings teams={teams} names={names} meetings={meetings} headToHead={headToHead} formatDate={formatDate} />
      ) : null}
    </div>
  );
}
