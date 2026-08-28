import type { MobileSupportInquiryDetailDto } from "@/packages/contracts/src/mobile-v1";
import { unlockSupportInquiry } from "@/lib/data/support";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await unlockSupportInquiry(inquiryId, password);
  if (!result.ok) return mobileError("BAD_REQUEST", result.error, 400);

  const data: MobileSupportInquiryDetailDto = result.detail;
  return mobileSuccess(data, { headers: { "Cache-Control": "no-store" } });
}
