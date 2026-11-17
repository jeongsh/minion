"use client";
import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { FanScheduleMatch } from "@/components/fan/fan-schedule-calendar";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import { useToast } from "@/components/ui/toast";

export function useCalendarMonth(initial: { homeMatches?: HomeCalendarMatch[]; fanMatches?: FanScheduleMatch[]; events: CalendarEvent[] }, teamId?: string) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function load(month: string) {
    const version = ++request.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({ month });
      if (teamId) query.set("team", teamId);
      const result = await fetch(`/api/calendar?${query}`);
      if (!result.ok) throw new Error("일정을 불러오지 못했습니다.");
      const next = await result.json();
      if (version !== request.current) return false;
      setData(next);
      return true;
    } catch (caught) {
      if (version === request.current) showToast({ title: caught instanceof Error ? caught.message : "일정을 불러오지 못했습니다.", tone: "error" });
      return false;
    } finally { if (version === request.current) setLoading(false); }
  }
  return { data, loading, load };
}
