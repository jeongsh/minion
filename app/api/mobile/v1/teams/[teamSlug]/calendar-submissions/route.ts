import type { MobileFanCalendarSubmissionDto } from "@/packages/contracts/src/mobile-v1";
import { isAdminUser } from "@/lib/auth/admin";
import { createFanCalendarSubmission } from "@/lib/calendar/submit-fan-calendar-event";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const { teamSlug } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const result = await createFanCalendarSubmission(
    { ...body, teamSlug },
    { isAdmin: isAdminUser(auth.user), userId: auth.user.id },
  );
  if (!result.ok) return mobileError("BAD_REQUEST", result.error ?? "일정 제보를 접수하지 못했어요.", 400);
  const data: MobileFanCalendarSubmissionDto = { message: result.message ?? "일정 제보가 접수됐어요." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
