"use server";

import { revalidatePath } from "next/cache";

import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createFanCalendarSubmission,
  type FanCalendarSubmissionResult,
} from "@/lib/calendar/submit-fan-calendar-event";

export type FanCalendarSubmissionActionResult = FanCalendarSubmissionResult;

export async function submitFanCalendarEventAction(
  rawInput: unknown,
): Promise<FanCalendarSubmissionActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인 후 일정을 제보할 수 있어요." };
  const result = await createFanCalendarSubmission(rawInput, {
    isAdmin: await isCurrentUserAdmin(),
    userId: user.id,
  });
  if (result.ok) revalidatePath("/admin/calendar");
  return result;
}
