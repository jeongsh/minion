import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";

const ALLOWED_SCRIPTS = [
  "backfill-timeline-events",
  "backfill-items-spells-runes",
  "backfill-leaguepedia-sets",
  "backfill-leaguepedia-set-ids",
  "backfill-leaguepedia-set-picks-bans",
  "backfill-csv-set-player-stats",
  "sync-leaguepedia-lck",
  "sync-career-history",
  "sync-player-images",
  "sync-youtube-videos",
  "subscribe-youtube-webhooks",
  "sync-pom",
  "sync-staff",
  "sync-lck-awards",
  "sync-instagram",
  "sync-international-matches",
  "import-international-rosters",
  "sync-international-rosters",
] as const;

type AllowedScript = (typeof ALLOWED_SCRIPTS)[number];

function isAllowed(script: string): script is AllowedScript {
  return (ALLOWED_SCRIPTS as readonly string[]).includes(script);
}

// UI에서 보내는 값은 항상 "--flag" 또는 "--flag=value" 형태뿐이라, 그 밖의 문자(공백/셸 메타문자 등)가
// 섞여 있으면 조작된 요청으로 간주하고 거부한다.
const SAFE_ARG_PATTERN = /^--[A-Za-z][A-Za-z0-9_-]*(=[\w.-]*)?$/;

function areArgsSafe(args: unknown): args is string[] {
  return Array.isArray(args) && args.every((arg) => typeof arg === "string" && SAFE_ARG_PATTERN.test(arg));
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { script?: string; args?: unknown } | null;
  const script = body?.script;
  const args = body?.args ?? [];

  if (!script || !isAllowed(script)) {
    return NextResponse.json({ error: "허용되지 않은 스크립트" }, { status: 403 });
  }
  if (!areArgsSafe(args)) {
    return NextResponse.json({ error: "허용되지 않은 인자" }, { status: 400 });
  }

  const cwd = resolve(process.cwd());
  const scriptPath = `scripts/${script}.ts`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn("npx", ["tsx", scriptPath, ...args], {
        cwd,
        env: { ...process.env },
        shell: true,
      });

      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // stream already closed
        }
      };

      child.stdout.on("data", (data: Buffer) => send(data.toString()));
      child.stderr.on("data", (data: Buffer) => send(data.toString()));

      child.on("close", (code) => {
        send(`\n__EXIT__:${code ?? -1}`);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      child.on("error", (err) => {
        send(`\n오류: ${err.message}\n__EXIT__:-1`);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
