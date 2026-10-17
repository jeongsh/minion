import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { cancelMatchWorkflow, getMatchWorkflow } from "@/lib/sync/admin-match-workflow";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isCurrentUserAdmin())) return NextResponse.json({ error: "관리자만 실행할 수 있습니다." }, { status: 403 });
  try {
    return NextResponse.json(await getMatchWorkflow(new URL(request.url).searchParams.get("runId") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "실행 상태 조회 실패" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isCurrentUserAdmin())) return NextResponse.json({ error: "관리자만 실행할 수 있습니다." }, { status: 403 });
  try {
    await cancelMatchWorkflow(new URL(request.url).searchParams.get("runId") ?? "");
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "작업 중지 실패" }, { status: 502 });
  }
}
