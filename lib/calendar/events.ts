// 덕질 달력 데이터 계층.
// 선수 생일(players.birth_date, 자동)과 관리자 입력 기념일(fan_calendar_events)을
// 하나의 CalendarEvent로 정규화하고, KST 기준 D-day / n주년을 계산한다.

import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllTeams } from "@/lib/data/lck";

export type CalendarEventType = "birthday" | "debut" | "championship" | "custom";

export type CalendarEvent = {
  /** 축하 보드 연결용 키. 'birthday:{playerId}:{year}' | 'event:{eventId}:{year}' */
  key: string;
  type: CalendarEventType;
  /** 완성된 라벨. 예: "페이커 생일", "T1 데뷔 3주년" */
  title: string;
  /** 표시용 대상 이름(선수명 또는 팀명) */
  subjectName: string;
  /** "MM-DD" (KST) */
  monthDay: string;
  /** 다가오는 실제 날짜 "YYYY-MM-DD" (KST) */
  nextDateKey: string;
  /** 0 = 오늘, 양수 = D-n */
  dday: number;
  /** 생일=나이, 데뷔/우승=n주년. 계산 불가 시 null */
  yearsCount: number | null;
  teamId: string | null;
  playerId: string | null;
  playerSlug: string | null;
  playerImageUrl: string | null;
  teamName: string | null;
  teamShort: string | null;
  teamColor: string | null;
  teamLogoUrl: string | null;
};

const TYPE_LABEL: Record<CalendarEventType, string> = {
  birthday: "생일",
  debut: "데뷔",
  championship: "우승",
  custom: "기념일",
};

/** KST 기준 오늘의 연/월/일. */
function todayPartsKST(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * (month, day)의 다가오는 발생일과 D-day를 계산한다.
 * 오늘의 월·일이면 dday=0, 지났으면 내년으로 넘긴다.
 */
function nextOccurrence(month: number, day: number, today: { year: number; month: number; day: number }) {
  // 2/29은 평년엔 2/28로 대체.
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const resolveDay = (y: number) => (month === 2 && day === 29 && !isLeap(y) ? 28 : day);

  const todayUTC = Date.UTC(today.year, today.month - 1, today.day);
  let year = today.year;
  let occUTC = Date.UTC(year, month - 1, resolveDay(year));
  if (occUTC < todayUTC) {
    year += 1;
    occUTC = Date.UTC(year, month - 1, resolveDay(year));
  }
  const dday = Math.round((occUTC - todayUTC) / 86_400_000);
  return { year, dday, nextDateKey: `${year}-${pad2(month)}-${pad2(resolveDay(year))}` };
}

type PlayerBirthRow = {
  id: string;
  slug: string;
  name: string;
  team_id: string | null;
  birth_date: string | null;
  profile_image_url: string | null;
};

type FanCalendarRow = {
  id: string;
  event_type: CalendarEventType;
  team_id: string | null;
  player_id: string | null;
  title: string;
  event_date: string;
  is_recurring: boolean;
};

/**
 * 덕질 달력 이벤트 목록. dday 오름차순 정렬.
 * @param opts.teamId 지정 시 해당 팀 선수 생일 + 해당 팀 기념일만 반환(팬페이지용).
 */
export async function getCalendarEvents(opts?: { teamId?: string }): Promise<CalendarEvent[]> {
  if (!canQuerySupabase()) return [];

  const teamId = opts?.teamId;
  const today = todayPartsKST();
  const teams = await getAllTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const supabase = createSupabaseServerClient();

  // 생일 소스: 활성 LCK 선수 중 birth_date 보유.
  let playerQuery = supabase
    .from("players")
    .select("id, slug, name, team_id, birth_date, profile_image_url")
    .eq("is_lck_player", true)
    .neq("is_active", false)
    .not("birth_date", "is", null);
  if (teamId) playerQuery = playerQuery.eq("team_id", teamId);

  // 관리자 입력 기념일.
  let eventQuery = supabase
    .from("fan_calendar_events")
    .select("id, event_type, team_id, player_id, title, event_date, is_recurring");
  if (teamId) eventQuery = eventQuery.eq("team_id", teamId);

  const [{ data: playerRows }, { data: eventRows }, { data: allPlayerRows }] = await Promise.all([
    playerQuery,
    eventQuery,
    // 기념일이 player_id를 참조할 때 이름/이미지를 붙이기 위한 조회.
    supabase.from("players").select("id, slug, name, team_id, birth_date, profile_image_url"),
  ]);

  const playerById = new Map((allPlayerRows as PlayerBirthRow[] | null ?? []).map((p) => [p.id, p]));

  const events: CalendarEvent[] = [];

  // ── 생일 ──
  for (const row of (playerRows as PlayerBirthRow[] | null) ?? []) {
    if (!row.birth_date) continue;
    const [by, bm, bd] = row.birth_date.split("-").map(Number);
    if (!bm || !bd) continue;
    const occ = nextOccurrence(bm, bd, today);
    const team = row.team_id ? teamById.get(row.team_id) : undefined;
    events.push({
      key: `birthday:${row.id}:${occ.year}`,
      type: "birthday",
      title: `${row.name} 생일`,
      subjectName: row.name,
      monthDay: `${pad2(bm)}-${pad2(bd)}`,
      nextDateKey: occ.nextDateKey,
      dday: occ.dday,
      yearsCount: by ? occ.year - by : null,
      teamId: row.team_id,
      playerId: row.id,
      playerSlug: row.slug,
      playerImageUrl: row.profile_image_url,
      teamName: team?.name ?? null,
      teamShort: team?.shortName ?? null,
      teamColor: team?.primaryColor ?? null,
      teamLogoUrl: team?.logoUrl ?? null,
    });
  }

  // ── 관리자 입력 기념일 ──
  for (const row of (eventRows as FanCalendarRow[] | null) ?? []) {
    const [ey, em, ed] = row.event_date.split("-").map(Number);
    if (!em || !ed) continue;
    const occ = nextOccurrence(em, ed, today);
    const player = row.player_id ? playerById.get(row.player_id) : undefined;
    const resolvedTeamId = row.team_id ?? player?.team_id ?? null;
    const team = resolvedTeamId ? teamById.get(resolvedTeamId) : undefined;
    const years = ey ? occ.year - ey : null;
    const subjectName = player?.name ?? team?.shortName ?? team?.name ?? row.title;
    const anniversary = years && years > 0 ? `${years}주년` : "";
    events.push({
      key: `event:${row.id}:${occ.year}`,
      type: row.event_type,
      title: [subjectName, row.title, anniversary].filter(Boolean).join(" "),
      subjectName,
      monthDay: `${pad2(em)}-${pad2(ed)}`,
      nextDateKey: occ.nextDateKey,
      dday: occ.dday,
      yearsCount: years,
      teamId: resolvedTeamId,
      playerId: row.player_id,
      playerSlug: player?.slug ?? null,
      playerImageUrl: player?.profile_image_url ?? null,
      teamName: team?.name ?? null,
      teamShort: team?.shortName ?? null,
      teamColor: team?.primaryColor ?? null,
      teamLogoUrl: team?.logoUrl ?? null,
    });
  }

  events.sort((a, b) => a.dday - b.dday || a.title.localeCompare(b.title));
  return events;
}

/** dday === 0 (오늘) 인 이벤트만. */
export function getTodayCelebrations(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.dday === 0);
}

export type CelebrationMessage = {
  id: string;
  eventKey: string;
  authorName: string | null;
  message: string;
  createdAt: string;
};

/** 특정 이벤트의 축하 메시지 목록(최신순). */
export async function getCelebrationMessages(eventKey: string): Promise<CelebrationMessage[]> {
  if (!canQuerySupabase()) return [];
  const { data } = await createSupabaseServerClient()
    .from("celebration_messages")
    .select("id, event_key, author_name, message, created_at")
    .eq("event_key", eventKey)
    .order("created_at", { ascending: false })
    .limit(200);

  return ((data as { id: string; event_key: string; author_name: string | null; message: string; created_at: string }[] | null) ?? []).map(
    (row) => ({
      id: row.id,
      eventKey: row.event_key,
      authorName: row.author_name,
      message: row.message,
      createdAt: row.created_at,
    }),
  );
}

export type FanCalendarEventRow = {
  id: string;
  eventType: CalendarEventType;
  teamId: string | null;
  playerId: string | null;
  title: string;
  eventDate: string;
  isRecurring: boolean;
};

/** 관리자 화면용 원본 기념일 목록(생일 제외, event_date 최신순). */
export async function getFanCalendarEvents(): Promise<FanCalendarEventRow[]> {
  if (!canQuerySupabase()) return [];
  const { data } = await createSupabaseServerClient()
    .from("fan_calendar_events")
    .select("id, event_type, team_id, player_id, title, event_date, is_recurring")
    .order("event_date", { ascending: false });

  return ((data as FanCalendarRow[] | null) ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    teamId: row.team_id,
    playerId: row.player_id,
    title: row.title,
    eventDate: row.event_date,
    isRecurring: row.is_recurring,
  }));
}

export { TYPE_LABEL };
