import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { isAdminUser } from "@/lib/auth/admin";
import { isStudioOriginAllowed, readStudioRequest, StudioRequestError } from "@/lib/community/ai-studio-request";
import { publishStudioCampaign, controlStudioQueue, studioDashboard } from "@/lib/community/ai-studio-publication";
import { draftStudioReply, approveStudioReply, dismissStudioReply } from "@/lib/community/ai-studio-replies";
import { StudioPublishError } from "@/lib/community/ai-studio-authors";
export const runtime = "nodejs";
export const maxDuration = 300;
const active = new Set<string>();
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const auth = await getVerifiedAuth();
  if (!auth || !isAdminUser(auth.user)) return json({ ok: false, error: "관리자만 사용할 수 있습니다." }, 403);
  try { return json({ ok: true, ...(await studioDashboard()) }); }
  catch (e) { return json({ ok: false, error: e instanceof StudioPublishError ? e.message : "목록 조회에 실패했습니다." }, 503); }
}
export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuth();
  if (!auth || !isAdminUser(auth.user) || !isStudioOriginAllowed(request)) return json({ ok: false, error: "관리자만 사용할 수 있습니다." }, 403);
  if (active.has(auth.user.id)) return json({ ok: false, error: "이전 작업이 진행 중입니다." }, 429);
  active.add(auth.user.id);
  try {
    const value = await readStudioRequest(request, 100 * 1024) as Record<string, unknown>;
    if (!value || typeof value !== "object") throw new StudioPublishError("요청 형식을 확인해 주세요.", 400);
    if (value.action === "publish") return json({ ok: true, ...(await publishStudioCampaign(value.draft)) });
    if (["draft_reply", "approve_reply", "dismiss_reply"].includes(String(value.action))) {
      if (typeof value.eventId !== "string") throw new StudioPublishError("검토 대상을 선택해 주세요.", 400);
      if (value.action === "draft_reply") await draftStudioReply(value.eventId);
      else if (value.action === "approve_reply") await approveStudioReply(value.eventId, value.text);
      else await dismissStudioReply(value.eventId);
    } else await controlStudioQueue(value);
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: e instanceof StudioPublishError || e instanceof StudioRequestError ? e.message : "요청 처리에 실패했습니다. 새로고침 후 다시 확인해 주세요." }, e instanceof StudioPublishError || e instanceof StudioRequestError ? e.status : 500); }
  finally { active.delete(auth.user.id); }
}
