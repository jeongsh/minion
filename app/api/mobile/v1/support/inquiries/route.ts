import type { MobileSupportBoardDto, MobileSupportInquiryMutationDto } from "@/packages/contracts/src/mobile-v1";
import { listSupportBoard } from "@/lib/data/support";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileCommunityActor } from "@/lib/mobile/community";
import { submitSupportInquiry } from "@/lib/support/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  try {
    const data: MobileSupportBoardDto = await listSupportBoard(page);
    return mobileSuccess(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return mobileError("INTERNAL", "게시판을 불러오지 못했습니다.", 500);
  }
}

export async function POST(request: Request) {
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const contactEmail = typeof body?.contactEmail === "string" ? body.contactEmail : "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const message = typeof body?.message === "string" ? body.message : "";
  const isPrivate = body?.isPrivate === true;
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await submitSupportInquiry(
    { userId: actor.auth?.user.id ?? null, guestKey: actor.auth ? null : actor.guest.key },
    { contactEmail, subject, message, isPrivate, password },
  );

  if (!result.ok || !result.id) return mobileError("BAD_REQUEST", result.error ?? "문의 접수에 실패했습니다.", 400);

  const data: MobileSupportInquiryMutationDto = { id: result.id, message: "문의가 접수됐어요." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" }, status: 201 });
}
