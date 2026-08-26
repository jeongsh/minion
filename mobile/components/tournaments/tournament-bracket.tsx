import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type View as RNView } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TeamLogo } from '@/components/data/team-logo';
import { tournamentTokens, type TournamentTokens } from '@/constants/tournament-theme';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileBracketData, MobileBracketMatch } from '@/lib/api-client';

const COLUMN_WIDTH = 200;
const COLUMN_GAP = 16;
// 웹 grid의 그룹 사이 빈 행(h-4) 양쪽에 gap-y-2가 붙어 총 32px을 차지한다.
const GROUP_GAP = 32;
const CARD_ROW_HEIGHT = 32;
const CARD_HEIGHT = CARD_ROW_HEIGHT * 2 + 1 + 2; // 두 팀 줄 + 구분선 1px + 위아래 테두리 1px씩
const DATE_HEIGHT = 18;
const DATE_GAP = 6;
const MATCH_UNIT_HEIGHT = DATE_HEIGHT + DATE_GAP + CARD_HEIGHT;
const MATCHES_GAP = 12;
const LABEL_HEIGHT = 18;
const LABEL_GAP = 8;
const ROW_GAP = 8;

/** 웹은 CSS Grid의 공유 행(row) 트랙 덕에, 특정 칸에 승자조 경기가 없어도 패자조가 이웃 칸의
 * 패자조와 같은 높이에서 시작한다. RN엔 그 개념이 없어서, 그룹 안에서 가장 큰 승자조 구획
 * 높이를 계산해 모든 칸의 패자조 시작 위치를 거기에 맞춰 스페이서로 밀어준다. */
function upperSectionHeight(matchCount: number) {
  if (matchCount === 0) return 0;
  return LABEL_HEIGHT + LABEL_GAP + matchCount * MATCH_UNIT_HEIGHT + (matchCount - 1) * MATCHES_GAP;
}

const BRACKET_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', { day: 'numeric', hour: '2-digit', hour12: false, minute: '2-digit', month: 'numeric', timeZone: 'Asia/Seoul' });

function formatBracketDateTime(value: string) {
  const parts = BRACKET_DATE_FORMATTER.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`;
}

type Rect = { height: number; width: number; x: number; y: number };
type MeasureFn = (matchId: string, node: RNView | null) => void;

/** 매치 카드들의 실제 화면 좌표를 모아 승자 진출 연결선(SVG)을 계산한다. 웹 bracket-connectors.tsx와 동일한 꺾은선(H-V-H) 공식. */
function useBracketConnectors(connections: MobileBracketData['connections']) {
  const containerRef = useRef<RNView>(null);
  const containerPos = useRef<{ x: number; y: number } | null>(null);
  const matchRects = useRef<Map<string, Rect>>(new Map());
  // 측정값(ref)이 갱신될 때마다 이 값을 올려서, connections만 바라보는 useMemo가 아니라
  // 실제 새 측정치로 paths가 다시 계산되게 만든다.
  const [renderTick, forceRender] = useState(0);
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const scheduleRender = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      forceRender((value) => value + 1);
    });
  }, []);

  // onLayout이 실제 배치가 끝난 뒤에만 오므로, ref가 붙는 시점이 아니라 여기서 재야
  // 레이아웃 확정 전(0,0 등 엉뚱한 값)을 측정하는 문제가 없다. 한 프레임 더 미뤄
  // 네이티브 쪽 커밋까지 확실히 끝난 뒤 measureInWindow를 부른다.
  const onContainerLayout = useCallback(() => {
    requestAnimationFrame(() => {
      containerRef.current?.measureInWindow((x, y) => {
        containerPos.current = { x, y };
        scheduleRender();
      });
    });
  }, [scheduleRender]);

  const registerMatch: MeasureFn = useCallback(
    (matchId, node) => {
      if (!node) return;
      requestAnimationFrame(() => {
        node.measureInWindow((x, y, width, height) => {
          if (width === 0 && height === 0) return;
          matchRects.current.set(matchId, { height, width, x, y });
          scheduleRender();
        });
      });
    },
    [scheduleRender],
  );

  const paths = useMemo(() => {
    const origin = containerPos.current;
    if (!origin) return [];

    function rowCenterY(matchId: string, row: 0 | 1 | null) {
      const rect = matchRects.current.get(matchId);
      if (!rect) return null;
      const top = rect.y - origin!.y;
      if (row === null) return top + rect.height / 2;
      return row === 0 ? top + CARD_ROW_HEIGHT / 2 : top + CARD_ROW_HEIGHT + 1 + CARD_ROW_HEIGHT / 2;
    }

    const byTarget = new Map<string, MobileBracketData['connections']>();
    for (const connection of connections) {
      const group = byTarget.get(connection.toMatchId) ?? [];
      group.push(connection);
      byTarget.set(connection.toMatchId, group);
    }

    const result: { d: string; id: string }[] = [];
    for (const [toMatchId, group] of byTarget) {
      const toRect = matchRects.current.get(toMatchId);
      if (!toRect) continue;
      const x2 = toRect.x - origin.x;

      const rawSources = group
        .map((connection) => {
          const fromRect = matchRects.current.get(connection.fromMatchId);
          const y1 = rowCenterY(connection.fromMatchId, connection.fromRow);
          if (!fromRect || y1 === null) return null;
          return { id: connection.fromMatchId, toRow: connection.toRow, x1: fromRect.x - origin.x + fromRect.width, y1 };
        })
        .filter((source): source is { id: string; toRow: 0 | 1 | null; x1: number; y1: number } => source !== null);
      if (rawSources.length === 0) continue;

      const sortedByY = rawSources.length > 1 ? [...rawSources].sort((a, b) => a.y1 - b.y1) : rawSources;
      for (const [index, source] of sortedByY.entries()) {
        const toRow: 0 | 1 | null = sortedByY.length > 1 ? (index === 0 ? 0 : 1) : source.toRow;
        const y2 = rowCenterY(toMatchId, toRow) ?? toRect.y - origin.y + toRect.height / 2;
        const midX = (source.x1 + x2) / 2;
        result.push({ d: `M ${source.x1} ${source.y1} H ${midX} V ${y2} H ${x2}`, id: `${source.id}->${toMatchId}` });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderTick은 값 자체가 아니라 ref(matchRects/containerPos)가 갱신됐다는 신호로만 쓴다.
  }, [connections, renderTick]);

  return { containerRef, onContainerLayout, paths, registerMatch };
}

export function TournamentBracket({ accent, bracket }: { accent: string; bracket: MobileBracketData }) {
  const tokens = useTournamentTokens();
  const { containerRef, onContainerLayout, paths, registerMatch } = useBracketConnectors(bracket.connections);
  // 앱 업데이트 전에 저장된 API 캐시에도 안전하게 대응한다. 새 응답은 원래 웹 열 번호를
  // 명시하고, 구 응답은 배열 순서를 열 번호로 사용한다.
  const columnCount = bracket.columnCount ?? Math.max(1, ...bracket.groups.map((group) => group.columns.length));
  const displayGroups = bracket.groups.length > 0 ? bracket.groups : [{ columns: [] }];

  return (
    <View style={[styles.outerBox, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View onLayout={onContainerLayout} ref={containerRef} style={styles.content}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {paths.map((path) => (
              <Path d={path.d} fill="none" key={path.id} stroke={tokens.border} strokeWidth={2} />
            ))}
          </Svg>
          {displayGroups.map((group, groupIndex) => {
            const maxUpperHeight = Math.max(0, ...group.columns.map((column) => upperSectionHeight(column.matches.length)));
            const columnsByIndex = new Map(group.columns.map((column, index) => [column.columnIndex ?? index, column]));
            return (
              <View key={groupIndex} style={[styles.groupRow, groupIndex > 0 && { marginTop: GROUP_GAP }]}>
                {Array.from({ length: columnCount }, (_, columnIndex) => {
                  const column = columnsByIndex.get(columnIndex);
                  return column ? (
                    <BracketColumnView column={column} key={columnIndex} maxUpperHeight={maxUpperHeight} registerMatch={registerMatch} />
                  ) : (
                    <View key={columnIndex} style={styles.column} />
                  );
                })}
                {groupIndex === 0 && bracket.finals ? <BracketFinalsColumn accent={accent} finals={bracket.finals} registerMatch={registerMatch} /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function useTournamentTokens() {
  const { colorScheme } = useMinionTheme();
  return tournamentTokens[colorScheme];
}

function BracketColumnView({
  column,
  maxUpperHeight,
  registerMatch,
}: {
  column: MobileBracketData['groups'][number]['columns'][number];
  maxUpperHeight: number;
  registerMatch: MeasureFn;
}) {
  const tokens = useTournamentTokens();
  const { fonts } = useMinionTheme();
  const ownUpperHeight = upperSectionHeight(column.matches.length);

  return (
    <View style={styles.column}>
      {column.matches.length > 0 ? (
        <View style={styles.columnSection}>
          <Text style={[styles.columnHeader, { color: tokens.muted, ...fonts.medium }]}>{column.label.toUpperCase()}</Text>
          <View style={styles.matchStack}>
            {column.matches.map((match) => (
              <BracketMatchCard key={match.id} match={match} registerMatch={registerMatch} />
            ))}
          </View>
        </View>
      ) : null}
      {column.lowerMatches.length > 0 ? (
        <>
          <View style={{ height: maxUpperHeight - ownUpperHeight + ROW_GAP }} />
          <View style={styles.columnSection}>
            <Text style={[styles.columnHeader, { color: tokens.muted, ...fonts.medium }]}>{(column.lowerLabel ?? '').toUpperCase()}</Text>
            <View style={styles.matchStack}>
              {column.lowerMatches.map((match) => (
                <BracketMatchCard key={match.id} match={match} registerMatch={registerMatch} />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function BracketFinalsColumn({ accent, finals, registerMatch }: { accent: string; finals: NonNullable<MobileBracketData['finals']>; registerMatch: MeasureFn }) {
  const tokens = useTournamentTokens();
  const { fonts } = useMinionTheme();

  return (
    <View style={styles.finalsColumn}>
      <Text style={[styles.columnHeader, { color: tokens.muted, ...fonts.medium }]}>{finals.label.toUpperCase()}</Text>
      <View style={styles.finalsCenter}>
        <BracketMatchCard accent={accent} final match={finals.match} registerMatch={registerMatch} teamAPlaceholder="Upper winner" teamBPlaceholder="Lower winner" />
      </View>
    </View>
  );
}

function BracketMatchCard({
  accent,
  final = false,
  match,
  registerMatch,
  teamAPlaceholder,
  teamBPlaceholder,
}: {
  accent?: string;
  final?: boolean;
  match: MobileBracketMatch;
  registerMatch: MeasureFn;
  teamAPlaceholder?: string;
  teamBPlaceholder?: string;
}) {
  const router = useRouter();
  const tokens = useTournamentTokens();
  const { fonts } = useMinionTheme();
  const nodeRef = useRef<RNView>(null);
  const winnerA = match.status === 'completed' && match.winnerTeamId === match.teamA?.id;
  const winnerB = match.status === 'completed' && match.winnerTeamId === match.teamB?.id;

  return (
    <View style={styles.matchUnit}>
      <Text numberOfLines={1} style={[styles.dateLabel, { color: tokens.muted, ...fonts.medium }]}>{formatBracketDateTime(match.matchDate)}</Text>
      <Pressable
        onLayout={() => registerMatch(match.id, nodeRef.current)}
        onPress={() => router.navigate(`/matches/${encodeURIComponent(match.id)}` as never)}
        ref={nodeRef}
        style={[
          styles.card,
          { backgroundColor: tokens.surface },
          final ? { borderColor: accent, borderWidth: 2 } : { borderColor: tokens.border, borderWidth: 1 },
        ]}>
        <BracketTeamRow accent={accent} isWinner={winnerA} placeholder={teamAPlaceholder} score={match.teamAScore} team={match.teamA} tokens={tokens} />
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <BracketTeamRow accent={accent} isWinner={winnerB} placeholder={teamBPlaceholder} score={match.teamBScore} team={match.teamB} tokens={tokens} />
      </Pressable>
    </View>
  );
}

function BracketTeamRow({
  accent,
  isWinner,
  placeholder,
  score,
  team,
  tokens,
}: {
  accent?: string;
  isWinner: boolean;
  placeholder?: string;
  score: number | null;
  team: MobileBracketMatch['teamA'];
  tokens: TournamentTokens;
}) {
  const { fonts } = useMinionTheme();
  const textColor = isWinner ? tokens.foreground : tokens.muted;

  return (
    <View style={styles.teamRow}>
      <View style={[styles.accentBar, { backgroundColor: team?.primaryColor ?? accent ?? tokens.muted }]} />
      <TeamLogo plain size={20} team={team} themeAware />
      <Text numberOfLines={1} style={[styles.teamName, { color: textColor, ...(isWinner ? fonts.bold : fonts.medium) }]}>
        {team?.name ?? placeholder ?? 'TBD'}
      </Text>
      <Text style={[styles.score, { color: textColor, ...(isWinner ? fonts.bold : fonts.medium) }]}>{score ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  accentBar: { alignSelf: 'stretch', borderRadius: 999, width: 4 },
  card: { borderRadius: 6, overflow: 'hidden', width: COLUMN_WIDTH },
  column: { width: COLUMN_WIDTH },
  columnHeader: { fontSize: 12, letterSpacing: 0.96, lineHeight: 18, textTransform: 'uppercase' },
  columnSection: { gap: 8 },
  content: { paddingBottom: 8 },
  dateLabel: { fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
  divider: { height: 1, width: '100%' },
  finalsCenter: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  finalsColumn: { gap: 8, width: COLUMN_WIDTH },
  groupRow: { flexDirection: 'row', gap: COLUMN_GAP },
  matchStack: { gap: 12 },
  matchUnit: { gap: 6 },
  outerBox: { borderRadius: 8, borderWidth: 1, padding: 16 },
  score: { flexShrink: 0, fontSize: 13, lineHeight: 19.5 },
  teamName: { flex: 1, fontSize: 13, lineHeight: 19.5, minWidth: 0 },
  teamRow: { alignItems: 'center', flexDirection: 'row', gap: 8, height: CARD_ROW_HEIGHT, paddingHorizontal: 10 },
});
