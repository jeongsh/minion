import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { TeamLogo } from '@/components/data/team-logo';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileMatchDetailDto } from '@/lib/api-client';
import type { MobileMatchPreviewCharts } from '../../../packages/contracts/src/mobile-v1';
import {
  FIRST_OBJECTIVE_KEYS, FIRST_OBJECTIVE_LABELS, recordMinuteLabel, recordRate, type PreviewHeadToHead, type PreviewTeamRecord, type RateRecord,
} from '../../../packages/contracts/src/preview-records';
import { Bar, Card, Copy, Legend } from './match-preview-charts';

type Meeting = MobileMatchDetailDto['preview']['meetings'][number];

const day = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(value));

/** 왼쪽 팀 값, 가운데 항목명, 오른쪽 팀 값. 막대는 가운데에서 바깥으로 자란다. */
function CompareRow({ label, left, right, labelWidth = 112 }: { label: string; left: ReactNode; right: ReactNode; labelWidth?: number | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>{left}</View>
      <Copy muted style={{ textAlign: 'center', ...(labelWidth == null ? null : { width: labelWidth }) }}>{label}</Copy>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>{right}</View>
    </View>
  );
}

/** 표본이 모자라면 비율 대신 "승/전체" 건수만 보여준다. */
function RateSide({ record, color, side }: { record: RateRecord; color: string; side: 'left' | 'right' }) {
  const rate = recordRate(record);
  const text = rate == null
    ? <Copy muted tabular style={{ flexShrink: 0 }}>{record.games ? `${record.wins}/${record.games}` : '-'}</Copy>
    : <Copy size={15} strong tabular style={{ flexShrink: 0 }}>{rate}%</Copy>;
  const track = (
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: side === 'left' ? 'flex-end' : 'flex-start' }}>
      {rate ? <Bar percent={Math.max(4, rate)} color={color} /> : null}
    </View>
  );
  return side === 'left' ? <>{text}{track}</> : <>{track}{text}</>;
}

function RateRow({ label, records, colors }: { label: string; records: RateRecord[]; colors: string[] }) {
  return (
    <CompareRow label={label}
      left={<RateSide record={records[0]} color={colors[0]} side="left" />}
      right={<RateSide record={records[1]} color={colors[1]} side="right" />} />
  );
}

function FormChips({ form, name }: { form: ('W' | 'L')[]; name: string }) {
  const { fonts, theme } = useMinionTheme();
  if (!form.length) return <Copy size={15} strong tabular>-</Copy>;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${name} 최근 ${form.length}경기 ${form.map((result) => result === 'W' ? '승' : '패').join(' ')}`} style={{ flexDirection: 'row', flexShrink: 0, gap: 2 }}>
      {form.map((result, index) => (
        <View key={index} style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: result === 'W' ? theme.ink : theme.card }}>
          <Text style={{ color: result === 'W' ? theme.surface : theme.muted, ...fonts.medium, fontSize: 12, lineHeight: 16, includeFontPadding: false }}>{result}</Text>
        </View>
      ))}
    </View>
  );
}

function TextRow({ label, values }: { label: string; values: string[] }) {
  return <CompareRow label={label} left={<Copy size={15} strong tabular>{values[0]}</Copy>} right={<Copy size={15} strong tabular>{values[1]}</Copy>} />;
}

function RecentFlow({ names, colors, records }: { names: string[]; colors: string[]; records: PreviewTeamRecord[] }) {
  return (
    <Card paired title="최근 흐름" legend={<Legend names={names} colors={colors} />}>
      <View style={{ gap: 14 }}>
        <CompareRow label="최근 5경기" labelWidth={null}
          left={<FormChips form={records[0].form} name={names[0]} />}
          right={<FormChips form={records[1].form} name={names[1]} />} />
        <RateRow label="세트 승률" records={records.map((record) => record.recentSets)} colors={colors} />
        <TextRow label="평균 경기 시간" values={records.map((record) => recordMinuteLabel(record.averageMinutes))} />
        <TextRow label="세트당 킬 합계" values={records.map((record) => record.averageTotalKills == null ? '-' : record.averageTotalKills.toFixed(1))} />
        {/* 타임라인이 없는 해외팀 보충 표본만 있으면 행 자체를 내지 않는다. */}
        {FIRST_OBJECTIVE_KEYS.filter((key) => records.some((record) => record.firsts[key].games)).map((key) => (
          <RateRow key={key} label={FIRST_OBJECTIVE_LABELS[key]} records={records.map((record) => record.firsts[key])} colors={colors} />
        ))}
      </View>
    </Card>
  );
}

function SeriesFlow({ names, colors, records }: { names: string[]; colors: string[]; records: PreviewTeamRecord[] }) {
  const outcomes = records[0].outcomes;
  return (
    <Card paired title="시리즈 흐름" legend={<Legend names={names} colors={colors} />}>
      <View style={{ gap: 14 }}>
        {outcomes.map((outcome, index) => (
          <RateRow key={outcome.label} label={`${outcome.label} ${outcome.win ? '승' : '패'}`} colors={colors}
            records={records.map((record) => ({ wins: record.outcomes[index].count, games: record.seriesMatches }))} />
        ))}
        <RateRow label="1세트 승률" records={records.map((record) => record.firstSet)} colors={colors} />
        <RateRow label="1세트 승리 시 승률" records={records.map((record) => record.afterFirstSetWin)} colors={colors} />
      </View>
    </Card>
  );
}

function Meetings({ names, meetings, headToHead }: { names: string[]; meetings: Meeting[]; headToHead: PreviewHeadToHead | null }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { fonts, theme } = useMinionTheme();
  const columns = width >= 768;
  return (
    <Card contentGap={12} title="맞대결">
      {headToHead ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          {[0, 1].map((index) => (
            <View key={index} style={{ flexDirection: index ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 8, minWidth: 0, flexShrink: 1 }}>
              <Copy size={16} strong tabular numberOfLines={1} style={{ flexShrink: 1 }}>{names[index]} {index ? headToHead.winsB : headToHead.winsA}승</Copy>
              <Copy muted tabular style={{ flexShrink: 0 }}>세트 {index ? headToHead.setWinsB : headToHead.setWinsA}승</Copy>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: columns ? 'row' : 'column', flexWrap: columns ? 'wrap' : 'nowrap', gap: 8 }}>
        {meetings.slice(0, 6).map((match) => (
          <Pressable key={match.id} accessibilityRole="link" onPress={() => router.push(`/matches/${encodeURIComponent(match.id)}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.card, ...(columns ? { flexBasis: '49%', flexGrow: 0, flexShrink: 1 } : null) }}>
            <Copy muted style={{ width: 48 }}>{day(match.startsAt)}</Copy>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 15, lineHeight: 22.5 }}>{match.teamA?.shortName ?? '-'}</Text>
                <TeamLogo plain size={20} team={match.teamA} themeAware />
              </View>
              <Text style={{ color: theme.ink, ...fonts.black, fontSize: 15, lineHeight: 22.5 }}>{match.teamAScore} : {match.teamBScore}</Text>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TeamLogo plain size={20} team={match.teamB} themeAware />
                <Text numberOfLines={1} style={{ color: theme.ink, flexShrink: 1, ...fonts.medium, fontSize: 15, lineHeight: 22.5 }}>{match.teamB?.shortName ?? '-'}</Text>
              </View>
            </View>
            <Copy size={12} muted style={{ width: 40, textAlign: 'right', lineHeight: 16 }}>BO{match.bestOf}</Copy>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/** AI 브리핑 안에서 관전 포인트 바로 아래에 놓는 전적 카드 묶음. 웹 MatchRecordCards와 같은 구성이다. */
export function MatchRecordCards({ names, colors, records, meetings }: {
  names: string[];
  colors: string[];
  records: MobileMatchPreviewCharts['records'];
  meetings: Meeting[];
}) {
  const { width } = useWindowDimensions();
  if (!meetings.length && !records) return null;
  return (
    <View style={{ gap: 12 }}>
      {meetings.length ? <Meetings names={names} meetings={meetings} headToHead={records?.headToHead ?? null} /> : null}
      {records ? (
        <View style={{ gap: 12, flexDirection: width >= 768 ? 'row' : 'column' }}>
          <RecentFlow names={names} colors={colors} records={records.teams} />
          <SeriesFlow names={names} colors={colors} records={records.teams} />
        </View>
      ) : null}
    </View>
  );
}
