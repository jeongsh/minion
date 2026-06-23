import { spawn } from "node:child_process";
import { resolve } from "node:path";

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
  "sync-instagram",
] as const;

type AllowedScript = (typeof ALLOWED_SCRIPTS)[number];

function isAllowed(script: string): script is AllowedScript {
  return (ALLOWED_SCRIPTS as readonly string[]).includes(script);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { script: string; args?: string[] };
  const { script, args = [] } = body;

  if (!isAllowed(script)) {
    return new Response(JSON.stringify({ error: "허용되지 않은 스크립트" }), { status: 403 });
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
        try { controller.close(); } catch { /* already closed */ }
      });

      child.on("error", (err) => {
        send(`\n오류: ${err.message}\n__EXIT__:-1`);
        try { controller.close(); } catch { /* already closed */ }
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
