import type { MobileSupportInquiryDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getSupportInquiryDetail } from "@/lib/data/support";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;
  const auth = await getMobileAuth(request);

  try {
    const detail: MobileSupportInquiryDetailDto | null = await getSupportInquiryDetail(inquiryId, auth?.user.id ?? null);
    if (!detail) return mobileError("NOT_FOUND", "문의를 찾을 수 없습니다.", 404);
    return mobileSuccess(detail, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return mobileError("INTERNAL", "문의를 불러오지 못했습니다.", 500);
  }
}
