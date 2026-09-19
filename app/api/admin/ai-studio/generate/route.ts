import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { parseStudioInput } from "@/lib/community/ai-studio";
import { generateStudioDraft, StudioGenerationError } from "@/lib/community/ai-studio-generator";
import { isStudioOriginAllowed, readStudioRequest, StudioRequestError } from "@/lib/community/ai-studio-request";

export const runtime = "nodejs";
export const maxDuration = 60;

// Admin-only prototype: prevent overlapping charges in the same server process.
const activeRequests = new Set<string>();

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuth();
  if (!auth) return failure("로그인 후 다시 시도해 주세요.", 401);
  if (!isAdminUser(auth.user)) return failure("관리자만 사용할 수 있습니다.", 403);
  if (!isStudioOriginAllowed(request)) return failure("허용되지 않은 요청입니다.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure("JSON 형식으로 보내 주세요.", 415);
  if (activeRequests.has(auth.user.id)) return failure("이미 대화를 생성하고 있습니다. 잠시 기다려 주세요.", 429);
  activeRequests.add(auth.user.id);
  try {
    const raw = await readStudioRequest(request);
    let input;
    try {
      input = parseStudioInput(raw);
    } catch (error) {
      return failure(error instanceof Error ? error.message : "입력 내용을 확인해 주세요.", 400);
    }
    const draft = await generateStudioDraft(input, { signal: request.signal });
    return NextResponse.json({ ok: true, draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudioGenerationError || error instanceof StudioRequestError) return failure(error.message, error.status);
    return failure("초안을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  } finally {
    activeRequests.delete(auth.user.id);
  }
}
