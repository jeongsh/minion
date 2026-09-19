import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { STUDIO_LIMITS } from "@/lib/community/ai-studio";
import { collectStudioSources, StudioCollectionError } from "@/lib/community/ai-studio-collector";
import { readStudioPublicPage } from "@/lib/community/ai-studio-public-page";
import { isStudioOriginAllowed, readStudioRequest, StudioRequestError } from "@/lib/community/ai-studio-request";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  if (activeRequests.has(auth.user.id)) return failure("이미 소재를 가져오고 있습니다. 잠시 기다려 주세요.", 429);
  activeRequests.add(auth.user.id);
  try {
    const raw = await readStudioRequest(request, 8 * 1024);
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof (raw as { url?: unknown }).url !== "string") return failure("가져올 주소 형식이 올바르지 않습니다.", 400);
    const url = (raw as { url: string }).url.trim();
    if (url.length > 2_000) return failure("주소는 2,000자 이하로 입력해 주세요.", 400);
    const excludeUrls = (raw as { excludeUrls?: unknown }).excludeUrls;
    if (excludeUrls !== undefined && (!Array.isArray(excludeUrls) || excludeUrls.length > 20 || excludeUrls.some((item) => typeof item !== "string" || item.length > 2_000))) return failure("최근 가져온 주소 형식이 올바르지 않습니다.", 400);
    let result = await collectStudioSources({ limit: 1, sourceUrl: url || undefined, excludeUrls: url ? undefined : excludeUrls as string[] | undefined }, { signal: request.signal });
    if (!url && result.sources[0]) result = await readStudioPublicPage(result.sources[0].url, fetch, request.signal) ?? result;
    const source = result.sources[0];
    if (!source) return failure("검색에서 사용할 수 있는 롤/LCK 소재를 찾지 못했습니다.", 422);
    const facts = [
      result.collectionMethod === "public_page" ? "[원문 제목·본문]" : "[출처 검색 요약]",
      `제목: ${source.title}`,
      `출처: ${source.url}`,
      `게시 날짜: ${source.publishedAt ?? "확인되지 않음"}`,
      `가져온 시각: ${result.collectedAt}`,
      "",
      source.excerpt,
      "",

    ].join("\n").slice(0, STUDIO_LIMITS.facts);
    return NextResponse.json({ ok: true, source: { title: source.title.slice(0, STUDIO_LIMITS.topic), url: source.url, facts, media: source.media ?? [], warnings: result.warnings } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudioCollectionError || error instanceof StudioRequestError) return failure(error.message, error.status);
    return failure("소재를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  } finally {
    activeRequests.delete(auth.user.id);
  }
}
