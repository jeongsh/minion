import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function POST() {
  return NextResponse.json(
    {
      error:
        "Script execution over HTTP is disabled. Run maintenance scripts from an authenticated operator shell or CI job.",
    },
    { status: 410 },
  );
}
