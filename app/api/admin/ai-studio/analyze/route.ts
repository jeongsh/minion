import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { isAdminUser } from "@/lib/auth/admin";
import { isStudioOriginAllowed, readStudioRequest } from "@/lib/community/ai-studio-request";
import { analyzeStudioMedia } from "@/lib/community/ai-studio-media-analysis";
import { StudioPublishError } from "@/lib/community/ai-studio-authors";
export const runtime = "nodejs";
export const maxDuration = 300;
const active = new Set<string>();
export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuth();
  if (!auth || !isAdminUser(auth.user) || !isStudioOriginAllowed(request)) return NextResponse.json({ ok: false, error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  if (active.has(auth.user.id)) return NextResponse.json({ ok: false, error: "미디어 분석이 진행 중입니다." }, { status: 429 });
  active.add(auth.user.id);
  try {
    const value = await readStudioRequest(request) as { media?: unknown; reference?: unknown };
    return NextResponse.json({ ok: true, ...(await analyzeStudioMedia(value.media, value.reference)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "미디어 분석에 실패했습니다." }, { status: e instanceof StudioPublishError ? e.status : 400 }); }
  finally { active.delete(auth.user.id); }
}
