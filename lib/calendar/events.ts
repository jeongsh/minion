// 덕질 달력 데이터 계층.
// 선수 생일(players.birth_date, 자동)과 관리자 입력 기념일(fan_calendar_events)을
// 하나의 CalendarEvent로 정규화하고, KST 기준 D-day / n주년을 계산한다.

import { cache } from "react";
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
  isRecurring: boolean;
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
  /** 팬사이트 경로 슬러그. 축하 게시판 링크 생성용 */
  teamFanSlug: string | null;
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

function daysUntil(dateKey: string, today: { year: number; month: number; day: number }) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;

  const todayUTC = Date.UTC(today.year, today.month - 1, today.day);
  const eventUTC = Date.UTC(year, month - 1, day);
  return Math.round((eventUTC - todayUTC) / 86_400_000);
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
export const getCalendarEvents = cache(async function getCalendarEvents(opts?: {
  teamId?: string;
}): Promise<CalendarEvent[]> {
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
      isRecurring: true,
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
      teamFanSlug: team?.fanSiteHost || team?.slug || null,
    });
  }

  // ── 관리자 입력 기념일 ──
  for (const row of (eventRows as FanCalendarRow[] | null) ?? []) {
    const [ey, em, ed] = row.event_date.split("-").map(Number);
    if (!em || !ed) continue;
    const oneTimeDday = row.is_recurring ? null : daysUntil(row.event_date, today);
    if (!row.is_recurring && (oneTimeDday == null || oneTimeDday < 0)) continue;
    const occ = row.is_recurring
      ? nextOccurrence(em, ed, today)
      : { year: ey, dday: oneTimeDday ?? 0, nextDateKey: row.event_date };
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
      isRecurring: row.is_recurring,
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
      teamFanSlug: team?.fanSiteHost || team?.slug || null,
    });
  }

  events.sort((a, b) => a.dday - b.dday || a.title.localeCompare(b.title));
  return events;
});

/** dday === 0 (오늘) 인 이벤트만. */
export function getTodayCelebrations(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.dday === 0);
}

/** 축하글이 모이는 게시판 경로. 팀이 없는 기념일은 허브 커뮤니티로 보낸다. */
export function celebrationBoardHref(event: CalendarEvent): string {
  return event.teamFanSlug ? `/fan/${event.teamFanSlug}/community` : "/community";
}

/** 축하글 작성 경로. 팀 게시판이면 '자유' 말머리를 미리 골라준다. */
export function celebrationWriteHref(event: CalendarEvent): string {
  const params = new URLSearchParams({ celebrate: event.key });
  if (!event.teamFanSlug) return `/community/new?${params.toString()}`;
  params.set("cat", "free");
  return `/fan/${event.teamFanSlug}/community/new?${params.toString()}`;
}

/** 축하글 기본 제목(작성 폼 프리필용). */
export function celebrationPostTitle(event: CalendarEvent): string {
  if (event.type === "birthday") {
    const nth = event.yearsCount ? ` ${event.yearsCount}번째` : "";
    return `🎂 ${event.subjectName} 선수${nth} 생일 축하해요!`;
  }
  // 기념일 title에는 이미 "n주년"이 포함되어 있다.
  return `🎉 ${event.title} 축하해요!`;
}

/**
 * eventKey에 해당하는 '오늘의' 기념일을 찾는다.
 * 클라이언트가 넘긴 키를 그대로 믿지 않기 위한 서버측 검증도 겸한다.
 */
export async function findTodayCelebration(
  eventKey: string,
  opts?: { teamId?: string },
): Promise<CalendarEvent | null> {
  if (!eventKey) return null;
  const events = await getCalendarEvents(opts);
  return getTodayCelebrations(events).find((event) => event.key === eventKey) ?? null;
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
export const getFanCalendarEvents = cache(async function getFanCalendarEvents(): Promise<
  FanCalendarEventRow[]
> {
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
});

export { TYPE_LABEL };
