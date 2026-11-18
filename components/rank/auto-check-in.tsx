"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import flag from "@/assets/characters/flag-3.png";
import { useToast } from "@/components/ui/toast";
import { checkInAction } from "@/lib/auth/actions";
import { INITIAL_ATTENDANCE_STATE } from "@/lib/auth/action-state";
import { attendanceDate, millisecondsUntilNextAttendanceDay } from "@/lib/rank/attendance-date";

/** Shared by every web route. The database enforces one award per user/day. */
export function AutoCheckIn({ userId }: { userId: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    let stopped = false;
    let pending = false;
    let checkedDate: string | null = null;
    let retryAfter = 0;
    let timer: ReturnType<typeof setTimeout>;

    function schedule() {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(() => void checkIn(), checkedDate === attendanceDate()
        ? millisecondsUntilNextAttendanceDay() + 100
        : 60_000);
    }

    async function checkIn() {
      if (stopped || pending) return;
      if (document.visibilityState !== "visible" || !navigator.onLine
        || checkedDate === attendanceDate() || Date.now() < retryAfter) {
        schedule();
        return;
      }
      pending = true;
      const date = attendanceDate();
      try {
        const result = await checkInAction(INITIAL_ATTENDANCE_STATE);
        if (stopped) return;
        if (result.status === "success" || result.status === "already") {
          checkedDate = date;
          if (result.status === "success") {
            showToast({
              title: "출석 도장 쾅!",
              description: "+100 LP 적립 완료",
              tone: "success",
              iconSrc: flag.src,
            });
          }
          // Also refresh on "already": another tab may have just earned the LP.
          router.refresh();
        } else {
          retryAfter = Date.now() + 60_000;
          if (result.status === "error") console.error(result.message);
        }
      } catch (error) {
        retryAfter = Date.now() + 60_000;
        console.error("자동 출석 처리 실패", error);
      } finally {
        pending = false;
        schedule();
      }
    }

    const onResume = () => void checkIn();
    void checkIn();
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [userId, router, showToast]);

  return null;
}
